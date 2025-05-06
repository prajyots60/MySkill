import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, BookOpen, Lightbulb, Video, Check, Award, Users, TrendingUp, BarChart, Zap } from "lucide-react"
import Link from "next/link"
import { HeroSection } from "@/components/hero-section"
import { FeaturedCourses } from "@/components/featured-courses"
import { TopCreators } from "@/components/top-creators"
import { LearningStreak } from "@/components/learning-streak"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />

      {/* Stats Banner */}
      <section className="py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center">
              <span className="text-3xl md:text-4xl font-bold">10K+</span>
              <span className="text-sm md:text-base opacity-90">Active Students</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl md:text-4xl font-bold">500+</span>
              <span className="text-sm md:text-base opacity-90">Courses</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl md:text-4xl font-bold">250+</span>
              <span className="text-sm md:text-base opacity-90">Instructors</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl md:text-4xl font-bold">4.8</span>
              <span className="text-sm md:text-base opacity-90">Average Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="py-12 px-4 md:px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Explore Top Categories</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            Discover the perfect course from our diverse range of categories tailored to your learning needs
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: <BookOpen className="h-8 w-8 mb-2" />, name: "Development", count: 120 },
              { icon: <BarChart className="h-8 w-8 mb-2" />, name: "Business", count: 85 },
              { icon: <Zap className="h-8 w-8 mb-2" />, name: "IT & Software", count: 75 },
              { icon: <Award className="h-8 w-8 mb-2" />, name: "Design", count: 65 },
              { icon: <TrendingUp className="h-8 w-8 mb-2" />, name: "Marketing", count: 55 },
              { icon: <Users className="h-8 w-8 mb-2" />, name: "Lifestyle", count: 45 },
            ].map((category, index) => (
              <Link href={`/explore?category=${category.name.toLowerCase()}`} key={index}>
                <div className="bg-card hover:bg-accent transition-colors rounded-lg p-4 text-center h-full flex flex-col items-center justify-center cursor-pointer border border-border hover:border-primary/50">
                  {category.icon}
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{category.count} courses</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 md:px-6 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How Our Platform Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A seamless experience for both creators and learners with our innovative educational platform
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-t-4 border-t-indigo-500 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <Video className="h-12 w-12 text-indigo-500 mb-2" />
                <CardTitle>Create & Upload</CardTitle>
                <CardDescription>Upload your videos or go live directly from our platform</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Our platform handles all the technical details. Your content is securely stored on YouTube but fully
                  managed through our interface.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Zero hosting costs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Automatic video optimization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>HD video streaming</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-purple-500 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <BookOpen className="h-12 w-12 text-purple-500 mb-2" />
                <CardTitle>Organize & Structure</CardTitle>
                <CardDescription>Create sections, add lectures, and upload supplementary materials</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Organize your content into a structured learning experience with sections, lectures, and additional
                  resources.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Intuitive course builder</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Drag-and-drop organization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Resource management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-blue-500 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <Lightbulb className="h-12 w-12 text-blue-500 mb-2" />
                <CardTitle>Share & Grow</CardTitle>
                <CardDescription>Share your courses and build your audience</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Easily share your courses with students. Track engagement and grow your audience with our built-in
                  tools.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Analytics dashboard</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Student engagement metrics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Revenue tracking</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <FeaturedCourses />

      {/* Learning Streak Section */}
      <LearningStreak />

      {/* Testimonials */}
      <section className="py-16 px-4 md:px-6 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">What Our Users Say</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Join thousands of satisfied students and instructors who are transforming the way they learn and teach
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Web Development Student",
                avatar: "/placeholder-user.jpg",
                content:
                  "This platform has completely transformed how I learn coding. The courses are structured perfectly and the ability to interact with instructors makes all the difference.",
                rating: 5,
              },
              {
                name: "Michael Chen",
                role: "Data Science Instructor",
                avatar: "/placeholder-user.jpg",
                content:
                  "As an instructor, I've tried many platforms, but none compare to the tools and support offered here. My audience has grown significantly in just a few months.",
                rating: 5,
              },
              {
                name: "Priya Patel",
                role: "Marketing Professional",
                avatar: "/placeholder-user.jpg",
                content:
                  "The quality of courses here is unmatched. I've learned more in 3 months than I did in a year of traditional learning. Highly recommend for professionals looking to upskill.",
                rating: 4,
              },
            ].map((testimonial, i) => (
              <Card key={i} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">{testimonial.name}</CardTitle>
                      <CardDescription>{testimonial.role}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex mb-4">
                    {Array(5)
                      .fill(0)
                      .map((_, index) => (
                        <svg
                          key={index}
                          className={`w-5 h-5 ${
                            index < testimonial.rating ? "text-yellow-400" : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                  </div>
                  <p className="text-sm italic">"{testimonial.content}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Instructors */}
      <TopCreators />

      <section className="py-16 px-4 md:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Teaching?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-primary-foreground/90">
            Join thousands of creators who are sharing their knowledge with the world. No technical skills required. 
            No video hosting costs. Start teaching today and reach students globally.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/auth/signin">
                Start Teaching <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full border-white text-white hover:bg-white/20">
              <Link href="/explore">
                Browse Courses
              </Link>
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div className="flex flex-col items-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-3">
                <Video className="h-8 w-8" />
              </div>
              <p>Unlimited Video Hosting</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-3">
                <Users className="h-8 w-8" />
              </div>
              <p>Global Student Reach</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-3">
                <TrendingUp className="h-8 w-8" />
              </div>
              <p>Growth Analytics</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-3">
                <Award className="h-8 w-8" />
              </div>
              <p>Creator Recognition</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
