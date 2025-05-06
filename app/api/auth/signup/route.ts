import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json()

    // Validate input
    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 })
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: "STUDENT", // Default role
        onboarded: false, // User needs to complete onboarding
      },
    })

    return NextResponse.json({ message: "User created successfully", userId: user.id }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "Failed to create user" }, { status: 500 })
  }
}
