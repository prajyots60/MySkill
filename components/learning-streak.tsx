"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Trophy, Star, Target, ArrowRight } from "lucide-react"
import Link from "next/link"

export function LearningStreak() {
  const [currentState, setCurrentState] = useState<"inactive" | "active" | "signup">("inactive")

  return (
    <section className="py-16 px-4 md:px-6 bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">Build Your Learning Habit</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Stay on track and maintain your momentum with daily learning streaks. 
              Set goals, earn rewards, and track your progress as you build valuable skills.
            </p>
            <div className="flex flex-col gap-5 mb-8">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-medium">Daily Learning Reminders</h3>
                  <p className="text-sm text-muted-foreground">Notifications that keep you accountable to your goals</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                  <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">Achievement Badges</h3>
                  <p className="text-sm text-muted-foreground">Earn rewards as you reach milestones in your learning journey</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-pink-100 dark:bg-pink-900/30 p-2 rounded-full">
                  <Target className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h3 className="font-medium">Personalized Learning Path</h3>
                  <p className="text-sm text-muted-foreground">Custom recommendations based on your goals and progress</p>
                </div>
              </div>
            </div>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link href="/auth/signup">
                Start Your Learning Streak <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex-1 flex justify-center">
            <Card className="w-full max-w-md overflow-hidden border-0 shadow-xl">
              <div className="p-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                <CardContent className="p-6 bg-card rounded-sm">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Your Learning Streak</h3>
                    <p className="text-sm text-muted-foreground">Keep your momentum going!</p>
                  </div>

                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <div className="text-3xl font-bold">14</div>
                      </div>
                      <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">
                        <Star className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-6">
                    {Array(7)
                      .fill(0)
                      .map((_, i) => {
                        const isActive = i < 5
                        return (
                          <div key={i} className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                              }`}
                            >
                              {isActive && <Star className="h-4 w-4" />}
                            </div>
                            <span className="text-xs">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                          </div>
                        )
                      })}
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Daily Goal: 15 mins</span>
                      <span className="text-sm text-muted-foreground">12/15 min</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: "80%" }}></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                      Continue Learning
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
