"use client"

import type React from "react"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import type { Course, Section, ContentType, Lecture } from "@/lib/types"

interface CourseFormState {
  title: string
  description: string
  type: ContentType
  price: string
  isPublished: boolean
  tags: string
  courseStatus?: string
  deliveryMode?: string
  accessDuration?: string
  languages?: string[]
}

interface CourseStore {
  // Course data
  course: Course | null
  sections: Section[]
  loading: boolean
  saving: boolean
  activeTab: string
  previewLecture: Lecture | null
  previewOpen: boolean

  // Upload tracking
  activeUploads: {
    id: string
    type: "lecture" | "document"
    title: string
    progress: number
    status: "uploading" | "processing" | "completed" | "failed"
    error?: string
    toastShown?: boolean
  }[]

  // Form states
  courseForm: CourseFormState
  newSectionTitle: string
  newSectionDescription: string
  addingSectionId: string | null
  addingLectureToSectionId: string | null
  newLectureTitle: string
  newLectureDescription: string
  newLectureIsPreview: boolean
  uploadingDocumentTo: {
    type: "course" | "section" | "lecture"
    id: string
  } | null
  newDocumentTitle: string
  newDocumentDescription: string
  newDocumentFile: File | null
  deleteConfirmation: {
    type: "course" | "section" | "lecture" | "document"
    id: string
    title: string
  } | null

  // Actions
  setCourse: (course: Course | null) => void
  setSections: (sections: Section[]) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setActiveTab: (tab: string) => void
  setCourseForm: (form: Partial<CourseFormState>) => void
  setNewSectionTitle: (title: string) => void
  setNewSectionDescription: (description: string) => void
  setAddingSectionId: (id: string | null) => void
  setAddingLectureToSectionId: (id: string | null) => void
  setNewLectureTitle: (title: string) => void
  setNewLectureDescription: (description: string) => void
  setNewLectureIsPreview: (isPreview: boolean) => void
  setUploadingDocumentTo: (to: { type: "course" | "section" | "lecture"; id: string } | null) => void
  setNewDocumentTitle: (title: string) => void
  setNewDocumentDescription: (description: string) => void
  setNewDocumentFile: (file: File | null) => void
  setDeleteConfirmation: (
    confirmation: { type: "course" | "section" | "lecture" | "document"; id: string; title: string } | null,
  ) => void
  setPreviewLecture: (lecture: Lecture | null) => void
  setPreviewOpen: (open: boolean) => void

  // Fetch course data
  fetchCourse: (courseId: string) => Promise<boolean>

  // Course operations
  handleCourseFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleCourseTypeChange: (value: string) => void
  handleCoursePublishedToggle: (checked: boolean) => void
  handleSaveCourse: (courseId: string) => Promise<boolean>
  handleDeleteCourse: (courseId: string) => Promise<boolean>

  // Section operations
  handleAddSection: (courseId: string) => Promise<boolean>
  handleDeleteSection: (sectionId: string) => Promise<boolean>
  handleEditSection: (sectionId: string, title: string, description: string) => Promise<boolean>

  // Lecture operations
  handleAddLecture: () => Promise<boolean>
  handleEditLecture: (lectureId: string, title: string, description: string, isPreview: boolean) => Promise<boolean>
  handleDeleteLecture: (lectureId: string) => Promise<boolean>

  // Document operations
  handleUploadDocument: () => Promise<boolean>
  handleDeleteDocument: (documentId: string) => Promise<boolean>

  // Reset form states
  resetFormStates: () => void

  // Upload tracking actions
  addUpload: (upload: { id: string; type: "lecture" | "document"; title: string }) => void
  updateUploadProgress: (id: string, progress: number) => void
  updateUploadStatus: (id: string, status: "uploading" | "processing" | "completed" | "failed", error?: string) => void
  removeUpload: (id: string) => void

  // New functions for language handling
  handleLanguagesChange: (languages: string[]) => void
  toggleLanguage: (language: string) => void
}

export const useCourseStore = create<CourseStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      course: null,
      sections: [],
      loading: false,
      saving: false,
      activeTab: "content",
      previewLecture: null,
      previewOpen: false,
      activeUploads: [],

      // Form states
      courseForm: {
        title: "",
        description: "",
        type: "COURSE",
        price: "0",
        isPublished: false,
        tags: "",
      },
      newSectionTitle: "",
      newSectionDescription: "",
      addingSectionId: null,
      addingLectureToSectionId: null,
      newLectureTitle: "",
      newLectureDescription: "",
      newLectureIsPreview: false,
      uploadingDocumentTo: null,
      newDocumentTitle: "",
      newDocumentDescription: "",
      newDocumentFile: null,
      deleteConfirmation: null,

      // Setters
      setCourse: (course) =>
        set((state) => {
          state.course = course
        }),
      setSections: (sections) =>
        set((state) => {
          state.sections = sections
        }),
      setLoading: (loading) =>
        set((state) => {
          state.loading = loading
        }),
      setSaving: (saving) =>
        set((state) => {
          state.saving = saving
        }),
      setActiveTab: (activeTab) =>
        set((state) => {
          state.activeTab = activeTab
        }),
      setCourseForm: (form) =>
        set((state) => {
          state.courseForm = { ...state.courseForm, ...form }
        }),
      setNewSectionTitle: (newSectionTitle) =>
        set((state) => {
          state.newSectionTitle = newSectionTitle
        }),
      setNewSectionDescription: (newSectionDescription) =>
        set((state) => {
          state.newSectionDescription = newSectionDescription
        }),
      setAddingSectionId: (addingSectionId) =>
        set((state) => {
          state.addingSectionId = addingSectionId
        }),
      setAddingLectureToSectionId: (addingLectureToSectionId) =>
        set((state) => {
          state.addingLectureToSectionId = addingLectureToSectionId
        }),
      setNewLectureTitle: (newLectureTitle) =>
        set((state) => {
          state.newLectureTitle = newLectureTitle
        }),
      setNewLectureDescription: (newLectureDescription) =>
        set((state) => {
          state.newLectureDescription = newLectureDescription
        }),
      setNewLectureIsPreview: (newLectureIsPreview) =>
        set((state) => {
          state.newLectureIsPreview = newLectureIsPreview
        }),
      setUploadingDocumentTo: (uploadingDocumentTo) =>
        set((state) => {
          state.uploadingDocumentTo = uploadingDocumentTo
        }),
      setNewDocumentTitle: (newDocumentTitle) =>
        set((state) => {
          state.newDocumentTitle = newDocumentTitle
        }),
      setNewDocumentDescription: (newDocumentDescription) =>
        set((state) => {
          state.newDocumentDescription = newDocumentDescription
        }),
      setNewDocumentFile: (newDocumentFile) =>
        set((state) => {
          state.newDocumentFile = newDocumentFile
        }),
      setDeleteConfirmation: (deleteConfirmation) =>
        set((state) => {
          state.deleteConfirmation = deleteConfirmation
        }),
      setPreviewLecture: (lecture) =>
        set((state) => {
          state.previewLecture = lecture
        }),
      setPreviewOpen: (open) =>
        set((state) => {
          state.previewOpen = open
        }),

      // Fetch course data
      fetchCourse: async (courseId) => {
        try {
          set((state) => {
            state.loading = true
          })

          console.log(`Fetching course: ${courseId}`)

          // Use the server action instead of direct database access
          const response = await fetch(`/api/courses/${courseId}`, {
            headers: {
              "Cache-Control": "no-cache",
            },
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch course: ${response.statusText}`)
          }

          const data = await response.json()

          if (data.course) {
            set((state) => {
              state.course = data.course
              state.sections = data.course.sections || []
              state.courseForm = {
                title: data.course.title,
                description: data.course.description,
                type: data.course.type as ContentType,
                price: data.course.price?.toString() || "0",
                isPublished: data.course.isPublished || false,
                tags: data.course.tags?.join(", ") || "",
                courseStatus: data.course.courseStatus || "UPCOMING",
                deliveryMode: data.course.deliveryMode || "VIDEO",
                accessDuration: data.course.accessDuration?.toString() || "12",
                languages: data.course.languages || ["English"],
              }
            })
            return true
          } else {
            console.error("Error fetching course:", data.error)
            return false
          }
        } catch (error) {
          console.error("Error fetching course:", error)
          return false
        } finally {
          set((state) => {
            state.loading = false
          })
        }
      },

      // Course operations
      handleCourseFormChange: (e) => {
        const { name, value } = e.target
        set((state) => {
          switch (name) {
            case "title":
            case "description":
            case "price":
            case "tags":
            case "accessDuration":
              state.courseForm[name] = value
              break;
            case "type":
              state.courseForm.type = value as ContentType
              break;
            case "isPublished":
              state.courseForm.isPublished = value === "true"
              break;
            case "courseStatus":
              state.courseForm.courseStatus = value
              break;
            case "deliveryMode":
              state.courseForm.deliveryMode = value
              break;
          }
        })
      },

      handleCourseTypeChange: (value) => {
        set((state) => {
          state.courseForm.type = value as ContentType
        })
      },

      handleCoursePublishedToggle: (checked) => {
        set((state) => {
          state.courseForm.isPublished = checked
        })
      },

      handleSaveCourse: async (courseId) => {
        const { courseForm } = get()
        try {
          set((state) => {
            state.saving = true
          })

          // Use fetch for this operation since it's a form submission
          const response = await fetch(`/api/creator/courses/${courseId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseForm.title,
              description: courseForm.description,
              type: courseForm.type,
              price: Number.parseFloat(courseForm.price),
              isPublished: courseForm.isPublished,
              tags: courseForm.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              courseStatus: courseForm.courseStatus,
              deliveryMode: courseForm.deliveryMode,
              accessDuration: Number.parseInt(courseForm.accessDuration || "12"),
              languages: courseForm.languages,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to update course")
          }

          const result = await response.json()

          if (result.success) {
            // Update local state
            const { course } = get()
            if (course) {
              set((state) => {
                state.course = {
                  ...course,
                  title: courseForm.title,
                  description: courseForm.description,
                  type: courseForm.type,
                  price: Number.parseFloat(courseForm.price),
                  isPublished: courseForm.isPublished,
                  tags: courseForm.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }
              })
            }
            return true
          } else {
            console.error("Failed to update course:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error saving course:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleDeleteCourse: async (courseId) => {
        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/courses/${courseId}`, {
            method: "DELETE",
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to delete course")
          }

          const result = await response.json()

          if (result.success) {
            return true
          } else {
            console.error("Failed to delete course:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error deleting course:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
            state.deleteConfirmation = null
          })
        }
      },

      // Section operations
      handleAddSection: async (courseId) => {
        const { newSectionTitle, newSectionDescription } = get()

        if (!newSectionTitle.trim()) {
          return false
        }

        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/courses/${courseId}/sections`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: newSectionTitle,
              description: newSectionDescription,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to add section")
          }

          const result = await response.json()

          if (result.success) {
            // Refresh course data
            await get().fetchCourse(courseId)

            // Reset form
            set((state) => {
              state.newSectionTitle = ""
              state.newSectionDescription = ""
            })
            return true
          } else {
            console.error("Failed to add section:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error adding section:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleDeleteSection: async (sectionId) => {
        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/sections/${sectionId}`, {
            method: "DELETE",
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to delete section")
          }

          const result = await response.json()

          if (result.success) {
            // Update local state
            set((state) => {
              state.sections = state.sections.filter((section) => section.id !== sectionId)
            })
            return true
          } else {
            console.error("Failed to delete section:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error deleting section:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleEditSection: async (sectionId, title, description) => {
        const { course } = get()
        if (!course) return false

        // Store the original section data in case we need to roll back
        const originalSection = get().sections.find(section => section.id === sectionId)
        if (!originalSection) return false

        try {
          set((state) => {
            state.saving = true
            // Optimistically update the UI for a better user experience
            state.sections = state.sections.map((section) =>
              section.id === sectionId
                ? { ...section, title, description }
                : section,
            )
          })

          const response = await fetch(`/api/creator/sections/${sectionId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ title, description }),
          })

          if (!response.ok) {
            // If the API call fails, roll back the UI change
            set((state) => {
              state.sections = state.sections.map((section) =>
                section.id === sectionId
                  ? { ...originalSection }
                  : section,
              )
            })
            throw new Error("Failed to update section")
          }

          const result = await response.json()

          if (result.success) {
            // The server has confirmed the update was successful
            return true
          } else {
            // If the server reports an error, roll back the UI change
            set((state) => {
              state.sections = state.sections.map((section) =>
                section.id === sectionId
                  ? { ...originalSection }
                  : section,
              )
            })
            console.error("Failed to update section:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error updating section:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      // Lecture operations
      handleAddLecture: async () => {
        const { addingLectureToSectionId, newLectureTitle, newLectureDescription, newLectureIsPreview, course } = get()

        if (!addingLectureToSectionId || !course) return false

        if (!newLectureTitle.trim()) {
          return false
        }

        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/sections/${addingLectureToSectionId}/lectures`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: newLectureTitle,
              description: newLectureDescription,
              type: "VIDEO",
              isPreview: newLectureIsPreview,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to add lecture")
          }

          const result = await response.json()

          if (result.success) {
            // Reset form
            set((state) => {
              state.newLectureTitle = ""
              state.newLectureDescription = ""
              state.newLectureIsPreview = false
              state.addingLectureToSectionId = null
            })

            // Refresh course data
            await get().fetchCourse(course.id)

            return true
          } else {
            console.error("Failed to add lecture:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error adding lecture:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleEditLecture: async (lectureId: string, title: string, description: string, isPreview: boolean) => {
        const { course } = get()
        if (!course) return false

        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/lectures/${lectureId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ title, description, isPreview }),
          })

          if (!response.ok) {
            throw new Error("Failed to update lecture")
          }

          const result = await response.json()

          if (result.success) {
            // Update local state
            set((state) => {
              state.sections = state.sections.map((section) => ({
                ...section,
                lectures: section.lectures.map((lecture) =>
                  lecture.id === lectureId ? { ...lecture, title, description, isPreview } : lecture,
                ),
              }))
            })
            return true
          } else {
            console.error("Failed to update lecture:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error updating lecture:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleDeleteLecture: async (lectureId) => {
        const { course } = get()
        if (!course) return false

        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/lectures/${lectureId}`, {
            method: "DELETE",
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to delete lecture")
          }

          const result = await response.json()

          if (result.success) {
            // Update local state
            set((state) => {
              state.sections = state.sections.map((section) => ({
                ...section,
                lectures: section.lectures.filter((lecture) => lecture.id !== lectureId),
              }))
              state.deleteConfirmation = null
            })
            return true
          } else {
            console.error("Failed to delete lecture:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error deleting lecture:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      // Document operations
      handleUploadDocument: async () => {
        const { uploadingDocumentTo, newDocumentTitle, newDocumentDescription, newDocumentFile, course } = get()

        if (!uploadingDocumentTo || !course) return false

        if (!newDocumentTitle.trim()) {
          return false
        }

        if (!newDocumentFile) {
          return false
        }

        try {
          set((state) => {
            state.saving = true
          })

          // Create FormData for file upload
          const formData = new FormData()
          formData.append("title", newDocumentTitle)
          formData.append("description", newDocumentDescription || "")
          formData.append("file", newDocumentFile)

          if (uploadingDocumentTo.type === "course") {
            formData.append("contentId", uploadingDocumentTo.id)
          } else if (uploadingDocumentTo.type === "section") {
            formData.append("sectionId", uploadingDocumentTo.id)
          } else if (uploadingDocumentTo.type === "lecture") {
            formData.append("lectureId", uploadingDocumentTo.id)
          }

          const response = await fetch("/api/creator/documents", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to upload document")
          }

          const result = await response.json()

          if (result.success) {
            // Reset form
            set((state) => {
              state.newDocumentTitle = ""
              state.newDocumentDescription = ""
              state.newDocumentFile = null
              state.uploadingDocumentTo = null
            })

            // Refresh course data
            await get().fetchCourse(course.id)

            return true
          } else {
            console.error("Failed to upload document:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error uploading document:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      handleDeleteDocument: async (documentId) => {
        const { course } = get()
        if (!course) return false

        try {
          set((state) => {
            state.saving = true
          })

          const response = await fetch(`/api/creator/documents/${documentId}`, {
            method: "DELETE",
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || "Failed to delete document")
          }

          const result = await response.json()

          if (result.success) {
            // Refresh course data
            await get().fetchCourse(course.id)

            set((state) => {
              state.deleteConfirmation = null
            })
            return true
          } else {
            console.error("Failed to delete document:", result.error)
            return false
          }
        } catch (error) {
          console.error("Error deleting document:", error)
          return false
        } finally {
          set((state) => {
            state.saving = false
          })
        }
      },

      // Reset form states
      resetFormStates: () => {
        set((state) => {
          state.newSectionTitle = ""
          state.newSectionDescription = ""
          state.addingSectionId = null
          state.addingLectureToSectionId = null
          state.newLectureTitle = ""
          state.newLectureDescription = ""
          state.newLectureIsPreview = false
          state.uploadingDocumentTo = null
          state.newDocumentTitle = ""
          state.newDocumentDescription = ""
          state.newDocumentFile = null
          state.deleteConfirmation = null
        })
      },

      // Upload tracking actions
      addUpload: (upload) => {
        set((state) => {
          state.activeUploads.push({ ...upload, progress: 0, status: "uploading" })
        })
      },

      updateUploadProgress: (id, progress) => {
        set((state) => {
          const uploadIndex = state.activeUploads.findIndex((upload) => upload.id === id)
          if (uploadIndex !== -1) {
            state.activeUploads[uploadIndex].progress = progress
          }
        })
      },

      updateUploadStatus: (id, status, error) => {
        set((state) => {
          const uploadIndex = state.activeUploads.findIndex((upload) => upload.id === id)
          if (uploadIndex !== -1) {
            state.activeUploads[uploadIndex].status = status
            
            // Reset toastShown for status changes
            if (status === "completed" || status === "failed") {
              state.activeUploads[uploadIndex].toastShown = false;
            }
            
            if (error) {
              state.activeUploads[uploadIndex].error = error
            }
          }
        })
      },

      removeUpload: (id) => {
        set((state) => {
          state.activeUploads = state.activeUploads.filter((upload) => upload.id !== id)
        })
      },

      handleLanguagesChange: (languages) => {
        set((state) => {
          state.courseForm.languages = languages;
        })
      },
      
      toggleLanguage: (language) => {
        set((state) => {
          if (!state.courseForm.languages) {
            state.courseForm.languages = [language];
            return;
          }
          
          if (state.courseForm.languages.includes(language)) {
            state.courseForm.languages = state.courseForm.languages.filter(lang => lang !== language);
          } else {
            state.courseForm.languages = [...state.courseForm.languages, language];
          }
        })
      },
    })),
    {
      name: "course-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        activeTab: state.activeTab,
        activeUploads: state.activeUploads,
      }),
    },
  ),
)
