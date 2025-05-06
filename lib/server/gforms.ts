import { google } from "googleapis"
import { prisma } from "@/lib/db"
import { Readable } from "stream"

// Initialize OAuth2 client - using the same client as Google Drive since they share authentication
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/googleforms/callback`,
)

// Google Forms API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
]

// Generate authorization URL
export function getAuthUrl(userId: string) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force to get refresh token
    state: userId, // Pass the user ID as state
  })
}

// Exchange code for tokens
export async function getTokensFromCode(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
  } catch (error) {
    console.error("Error getting tokens:", error)
    throw error
  }
}

// Get authenticated Google Forms client
export async function getGFormsClient(userId: string) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Forms")
    }

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Create Forms client
    const forms = google.forms({
      version: "v1",
      auth: oauth2Client,
    })

    return forms
  } catch (error) {
    console.error("Error getting Google Forms client:", error)
    throw error
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string) {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    return credentials
  } catch (error) {
    console.error("Error refreshing access token:", error)
    throw error
  }
}

// Create a new Google Form with token provided from the client
export async function createFormWithToken(token: string, formData: {
  title: string,
  description?: string,
}) {
  try {
    // Set credentials with the provided token
    if (!token) {
      throw new Error("No access token provided")
    }

    // Configure auth client with the provided token
    const authClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    authClient.setCredentials({ access_token: token })

    // First get Drive client to create form
    const drive = google.drive({
      version: "v3",
      auth: authClient,
    })

    // Create form
    const form = await drive.files.create({
      requestBody: {
        name: formData.title,
        mimeType: "application/vnd.google-apps.form",
      },
      fields: "id",
    })

    const formId = form.data.id

    if (!formId) {
      throw new Error("Failed to create form")
    }

    // Now use the Forms API to update the form
    const forms = google.forms({
      version: "v1",
      auth: authClient,
    })
    
    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateFormInfo: {
              info: {
                title: formData.title,
                description: formData.description || "",
              },
              updateMask: "title,description",
            },
          },
        ],
      },
    })

    // Get the form URL
    const formUrl = `https://docs.google.com/forms/d/${formId}/edit`

    // Create a response destination (Google Sheet)
    const sheets = google.sheets({
      version: "v4",
      auth: authClient,
    })

    const sheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${formData.title} - Responses`,
        },
      },
    })

    const sheetId = sheet.data.spreadsheetId

    // Link form to the sheet for responses
    if (sheetId) {
      try {
        // Since the Forms API v1beta doesn't seem to be directly accessible
        // and _request method isn't available, let's use a more direct approach
        const forms = google.forms({
          version: "v1",
          auth: oauth2Client,
        });
        
        try {
          // We'll use the OAuth token directly with a fetch request to the API
          const accessToken = (await oauth2Client.getAccessToken()).token;
          
          if (!accessToken) {
            throw new Error("Could not obtain access token");
          }
          
          const response = await fetch(`https://forms.googleapis.com/v1beta/forms/${formId}:watch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              target: {
                spreadsheetId: sheetId
              }
            })
          });
          
          if (!response.ok) {
            console.error(`Error linking form to spreadsheet: ${response.status} ${response.statusText}`);
            // We can still use the form even if linking fails
          }
        } catch (error) {
          console.error("Error linking form to spreadsheet (fallback method):", error);
          // We can still use the form even if linking fails
        }
      } catch (error) {
        console.error("Error linking form to spreadsheet:", error);
        // We can still use the form even if linking fails
      }
    }

    return {
      formId,
      formUrl,
      responseSheetId: sheetId,
    }
  } catch (error) {
    console.error("Error creating Google Form with token:", error)
    throw error
  }
}

// Create a new Google Form
export async function createForm(userId: string, formData: {
  title: string,
  description?: string,
}) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Forms. Please connect your Google account first.")
    }

    // Set credentials with the user's refresh token
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // First get Drive client to create form
    const drive = google.drive({
      version: "v3",
      auth: oauth2Client,
    })

    // Create form
    const form = await drive.files.create({
      requestBody: {
        name: formData.title,
        mimeType: "application/vnd.google-apps.form",
      },
      fields: "id",
    })

    const formId = form.data.id

    if (!formId) {
      throw new Error("Failed to create form")
    }

    // Initialize the forms client here so it's available throughout the function
    let formsClient;
    
    try {
      // Now use the Forms API to update the form
      formsClient = await getGFormsClient(userId)
      
      await formsClient.forms.batchUpdate({
        formId,
        requestBody: {
          requests: [
            {
              updateFormInfo: {
                info: {
                  title: formData.title,
                  description: formData.description || "",
                },
                updateMask: "title,description",
              },
            },
          ],
        },
      })
    } catch (error: any) {
      // Check for API not enabled error
      const errorMessage = error?.message || '';
      if (errorMessage.includes("has not been used in project") || 
          errorMessage.includes("it is disabled") || 
          errorMessage.includes("API has not been used")) {
        // Extract project ID from error message if available
        const projectIdMatch = errorMessage.match(/project\s+(\d+)/);
        const projectId = projectIdMatch ? projectIdMatch[1] : '';
        
        // Construct the API enable URL
        const enableUrl = projectId 
          ? `https://console.developers.google.com/apis/api/forms.googleapis.com/overview?project=${projectId}`
          : "https://console.cloud.google.com/apis/library/forms.googleapis.com";
        
        throw new Error(
          `The Google Forms API is not enabled for your project. Please enable it by visiting ${enableUrl} and try again. ` +
          "After enabling the API, it may take a few minutes to propagate."
        )
      }
      throw error;
    }

    // Get the form URL
    const formUrl = `https://docs.google.com/forms/d/${formId}/edit`

    // Create a response destination (Google Sheet)
    const sheets = google.sheets({
      version: "v4",
      auth: oauth2Client,
    })

    const sheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${formData.title} - Responses`,
        },
      },
    })

    const sheetId = sheet.data.spreadsheetId

    // Link form to the sheet for responses
    if (sheetId) {
      try {
        // Since the Forms API v1beta doesn't seem to be directly accessible
        // and _request method isn't available, let's use a more direct approach
        const forms = google.forms({
          version: "v1",
          auth: oauth2Client,
        });
        
        try {
          // We'll use the OAuth token directly with a fetch request to the API
          const accessToken = (await oauth2Client.getAccessToken()).token;
          
          if (!accessToken) {
            throw new Error("Could not obtain access token");
          }
          
          const response = await fetch(`https://forms.googleapis.com/v1beta/forms/${formId}:watch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              target: {
                spreadsheetId: sheetId
              }
            })
          });
          
          if (!response.ok) {
            console.error(`Error linking form to spreadsheet: ${response.status} ${response.statusText}`);
            // We can still use the form even if linking fails
          }
        } catch (error) {
          console.error("Error linking form to spreadsheet (fallback method):", error);
          // We can still use the form even if linking fails
        }
      } catch (error) {
        console.error("Error linking form to spreadsheet:", error);
        // We can still use the form even if linking fails
      }
    }

    return {
      formId,
      formUrl,
      responseSheetId: sheetId,
    }
  } catch (error) {
    console.error("Error creating Google Form:", error)
    throw error
  }
}

// Add question to Google Form
export async function addQuestionToForm(userId: string, formId: string, questionData: {
  text: string,
  type: "MULTIPLE_CHOICE" | "CHECKBOX" | "SHORT_ANSWER" | "PARAGRAPH",
  required: boolean,
  options?: { text: string, isCorrect: boolean }[],
}) {
  try {
    const forms = await getGFormsClient(userId)

    let request: any = {
      createItem: {
        item: {
          title: questionData.text,
          questionItem: {
            question: {
              required: questionData.required,
            }
          }
        },
        location: {
          index: 0,
        },
      },
    }

    // Set question type
    switch (questionData.type) {
      case "MULTIPLE_CHOICE":
        request.createItem.item.questionItem.question.choiceQuestion = {
          type: "RADIO",
          options: questionData.options?.map(opt => ({ value: opt.text })) || [],
        }
        break
      case "CHECKBOX":
        request.createItem.item.questionItem.question.choiceQuestion = {
          type: "CHECKBOX",
          options: questionData.options?.map(opt => ({ value: opt.text })) || [],
        }
        break
      case "SHORT_ANSWER":
        request.createItem.item.questionItem.question.textQuestion = {
          paragraph: false,
        }
        break
      case "PARAGRAPH":
        request.createItem.item.questionItem.question.textQuestion = {
          paragraph: true,
        }
        break
    }

    const response = await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [request],
      },
    })

    // Extract the created question ID
    const questionId = response.data.replies?.[0]?.createItem?.questionId || ""
    
    // Extract option IDs if applicable
    let optionIds: string[] = []
    if (["MULTIPLE_CHOICE", "CHECKBOX"].includes(questionData.type) && response.data.replies?.[0]?.createItem?.item?.questionItem?.question?.choiceQuestion?.options) {
      optionIds = response.data.replies[0].createItem.item.questionItem.question.choiceQuestion.options.map((option: any) => option.value)
    }

    return {
      questionId,
      optionIds,
    }
  } catch (error) {
    console.error("Error adding question to Google Form:", error)
    throw error
  }
}

// Get form responses
export async function getFormResponses(userId: string, formId: string, sheetId: string) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Forms")
    }

    // Set credentials with the user's refresh token
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })
    
    const sheets = google.sheets({
      version: "v4",
      auth: oauth2Client,
    })

    // Get responses from the linked Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:Z", // Get all data
    })

    return response.data.values || []
  } catch (error) {
    console.error("Error getting form responses:", error)
    throw error
  }
}

// Publish form and get public URL
export async function publishForm(userId: string, formId: string) {
  try {
    // Get user's refresh token from database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        scope: {
          contains: "forms.body"
        }
      },
    })

    if (!account?.refresh_token) {
      throw new Error("User not connected to Google Forms")
    }

    // Set credentials with the user's refresh token
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    // Use the Drive API to modify the form metadata directly
    const drive = google.drive({
      version: "v3",
      auth: oauth2Client,
    })

    // 1. First, apply the permissions to make it accessible to anyone with the link
    await drive.permissions.create({
      fileId: formId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    })

    // 2. Then update the file properties to exit "preview mode"
    // Note: This uses undocumented form properties but is currently the most reliable way
    await drive.files.update({
      fileId: formId,
      requestBody: {
        properties: {
          "formSettings.responseAcceptingMode": "acceptingResponses"
        }
      }
    })

    // 3. Get the published form URL 
    const formResponse = await drive.files.get({
      fileId: formId,
      fields: "webViewLink",
    })

    // Convert the edit URL to a response URL
    const publishedUrl = formResponse.data.webViewLink?.replace('/edit', '/viewform') || '';

    return {
      publishedUrl,
    }
  } catch (error) {
    console.error("Error publishing Google Form:", error)
    throw error
  }
}

// Close form to new responses
export async function closeForm(userId: string, formId: string) {
  try {
    const forms = await getGFormsClient(userId)

    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateSettings: {
              settings: {
                quizSettings: {
                  isQuiz: true,
                }
              },
              updateMask: "quizSettings",
            },
          },
        ],
      },
    })

    return true
  } catch (error) {
    console.error("Error closing Google Form:", error)
    throw error
  }
}