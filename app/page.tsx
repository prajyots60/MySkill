






import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, BookOpen, Lightbulb, Video, Check, Award, Users, TrendingUp, BarChart, Zap } from "lucide-react"
import Link from "next/link"
import { HeroSection } from "@/components/hero-section"
import { LearningStreak } from "@/components/learning-streak"
import { AnimatedHeading } from "@/components/animated-heading"
import { AnimatedButton } from "@/components/animated-button"
import { AnimatedSection } from "@/components/animated-section"
import { FeatureCard3D } from "@/components/feature-card-3d"
import { PremiumCard } from "@/components/premium-card"
import { ClientParticleWrapper } from "@/components/client-particle-wrapper"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden">
      {/* Particle background for the entire page */}
      <ClientParticleWrapper color="#6366f1" quantity={70} speed={0.5} />
      
      <div className="animated-gradient-dark w-full absolute h-full top-0 left-0 z-[-1] opacity-50" />
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <AnimatedSection animation="fade-up">
            <h1 className="text-5xl md:text-6xl font-bold text-center bg-gradient-to-r from-indigo-500 to-purple-600 text-transparent bg-clip-text mb-6 neon-text">
              Transform Your Learning Journey
            </h1>
            <p className="text-xl text-center text-muted-foreground max-w-2xl mx-auto mb-10">
              Join thousands of students and instructors on the premium educational platform 
              powered by YouTube integration for seamless learning experiences.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
              <AnimatedButton variant="premium" size="lg" asChild>
                <Link href="/explore">
                  Explore Courses <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </AnimatedButton>
              <AnimatedButton variant="outline" size="lg" asChild>
                <Link href="/auth/signin">
                  Get Started
                </Link>
              </AnimatedButton>
            </div>
          </AnimatedSection>
            
          {/* Floating elements */}
          <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-indigo-500/20 blur-2xl float"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl float-slow"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-blue-500/20 blur-2xl float-fast"></div>
        </div>
        
        {/* Wave animation */}
        <div className="wave-animation">
          <div className="wave"></div>
          <div className="wave"></div>
          <div className="wave"></div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-10 bg-gradient-to-r from-indigo-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-10"></div>
        
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center relative z-10">
            <AnimatedSection animation="fade-up" delay={0.1} className="glass p-6 rounded-xl flex flex-col items-center">
              <span className="text-4xl md:text-5xl font-bold mb-2 neon-text">10K+</span>
              <span className="text-sm md:text-base opacity-90">Active Students</span>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.2} className="glass p-6 rounded-xl flex flex-col items-center">
              <span className="text-4xl md:text-5xl font-bold mb-2 neon-text">500+</span>
              <span className="text-sm md:text-base opacity-90">Courses</span>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.3} className="glass p-6 rounded-xl flex flex-col items-center">
              <span className="text-4xl md:text-5xl font-bold mb-2 neon-text">250+</span>
              <span className="text-sm md:text-base opacity-90">Instructors</span>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.4} className="glass p-6 rounded-xl flex flex-col items-center">
              <span className="text-4xl md:text-5xl font-bold mb-2 neon-text">4.8</span>
              <span className="text-sm md:text-base opacity-90">Average Rating</span>
            </AnimatedSection>
          </div>
        </div>
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 shimmer"></div>
      </section>

      {/* Category Cards */}
      <section className="py-20 px-4 md:px-6 relative">
        <div className="container mx-auto">
          <AnimatedHeading 
            title="Explore Top Categories" 
            subtitle="Discover the perfect course from our diverse range of categories tailored to your learning needs"
            highlight={true}
            animationType="slide"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-16">
            {[
              { icon: <BookOpen className="h-10 w-10 mb-2" />, name: "Development", count: 120, color: "indigo" },
              { icon: <BarChart className="h-10 w-10 mb-2" />, name: "Business", count: 85, color: "blue" },
              { icon: <Zap className="h-10 w-10 mb-2" />, name: "IT & Software", count: 75, color: "cyan" },
              { icon: <Award className="h-10 w-10 mb-2" />, name: "Design", count: 65, color: "purple" },
              { icon: <TrendingUp className="h-10 w-10 mb-2" />, name: "Marketing", count: 55, color: "pink" },
              { icon: <Users className="h-10 w-10 mb-2" />, name: "Lifestyle", count: 45, color: "violet" },
            ].map((category, index) => (
              <AnimatedSection key={index} animation="fade-up" delay={index * 0.1} className="h-full">
                <PremiumCard 
                  className="h-full glass-dark hover:border-indigo-500/50 border-transparent" 
                  hoverEffect="tilt"
                  glowColor={`rgba(var(--${category.color}-500), 0.4)`}
                >
                  <Link href={`/explore?category=${category.name.toLowerCase()}`} className="block p-6 h-full">
                    <div className="flex flex-col items-center justify-center text-center h-full">
                      <div className="transition-transform duration-300 hover:scale-110" style={{ color: `var(--${category.color}-500, #6366f1)` }}>
                        {category.icon}
                      </div>
                      <h3 className="font-medium mt-2">{category.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{category.count} courses</p>
                    </div>
                  </Link>
                </PremiumCard>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-6 bg-muted/20 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-5"></div>
        <div className="container mx-auto">
          <AnimatedHeading 
            title="How Our Platform Works" 
            subtitle="A seamless experience for both creators and learners with our innovative educational platform"
            highlight={true}
            animationType="slide"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <AnimatedSection animation="fade-up" delay={0.1}>
              <FeatureCard3D
                icon={<Video className="h-12 w-12" />}
                title="Create & Upload"
                description="Upload your videos or go live directly from our platform"
                borderColor="indigo-500"
              >
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
              </FeatureCard3D>
            </AnimatedSection>

            <AnimatedSection animation="fade-up" delay={0.2}>
              <FeatureCard3D
                icon={<BookOpen className="h-12 w-12" />}
                title="Organize & Structure"
                description="Create sections, add lectures, and upload supplementary materials"
                borderColor="purple-500"
              >
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
              </FeatureCard3D>
            </AnimatedSection>

            <AnimatedSection animation="fade-up" delay={0.3}>
              <FeatureCard3D
                icon={<Lightbulb className="h-12 w-12" />}
                title="Share & Grow"
                description="Share your courses and build your audience"
                borderColor="blue-500"
              >
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
              </FeatureCard3D>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Learning Streak Section */}
      <LearningStreak />

      <section className="py-20 px-4 md:px-6 bg-gradient-to-b from-indigo-900/20 to-purple-900/20 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-5"></div>
        <div className="container mx-auto text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-500 text-transparent bg-clip-text">Ready to Transform Your Teaching?</h2>
            <p className="max-w-2xl mx-auto mb-8 text-muted-foreground">
              Join thousands of creators who are sharing their knowledge with the world. No technical skills required. 
              No video hosting costs. Start teaching today and reach students globally.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
              <AnimatedButton variant="glow" size="lg" asChild>
                <Link href="/auth/signin">
                  Start Teaching <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </AnimatedButton>
              <AnimatedButton variant="outline" size="lg" asChild>
                <Link href="/explore">
                  Browse Courses
                </Link>
              </AnimatedButton>
            </div>
          </AnimatedSection>
          
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <AnimatedSection animation="fade-up" delay={0.1} className="flex flex-col items-center">
              <div className="bg-indigo-500/20 rounded-full w-16 h-16 flex items-center justify-center mb-3 ring-4 ring-indigo-500/10">
                <Video className="h-8 w-8" style={{ color: 'var(--indigo-500, #6366f1)' }} />
              </div>
              <p className="text-muted-foreground">Unlimited Video Hosting</p>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.2} className="flex flex-col items-center">
              <div className="bg-purple-500/20 rounded-full w-16 h-16 flex items-center justify-center mb-3 ring-4 ring-purple-500/10">
                <Users className="h-8 w-8" style={{ color: 'var(--purple-500, #a855f7)' }} />
              </div>
              <p className="text-muted-foreground">Global Student Reach</p>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.3} className="flex flex-col items-center">
              <div className="bg-blue-500/20 rounded-full w-16 h-16 flex items-center justify-center mb-3 ring-4 ring-blue-500/10">
                <TrendingUp className="h-8 w-8" style={{ color: 'var(--blue-500, #3b82f6)' }} />
              </div>
              <p className="text-muted-foreground">Growth Analytics</p>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-up" delay={0.4} className="flex flex-col items-center">
              <div className="bg-violet-500/20 rounded-full w-16 h-16 flex items-center justify-center mb-3 ring-4 ring-violet-500/10">
                <Award className="h-8 w-8" style={{ color: 'var(--violet-500, #8b5cf6)' }} />
              </div>
              <p className="text-muted-foreground">Creator Recognition</p>
            </AnimatedSection>
          </div>
        </div>
      </section>
      
      {/* Add client-side script for scroll animations */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('DOMContentLoaded', function() {
            const fadeElements = document.querySelectorAll('.fade-in-up');
            const blurElements = document.querySelectorAll('.blur-load');
            
            const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  entry.target.classList.add('active');
                  observer.unobserve(entry.target);
                }
              });
            }, { threshold: 0.1 });
            
            fadeElements.forEach(el => observer.observe(el));
            blurElements.forEach(el => observer.observe(el));
            
            // Parallax effect
            const parallaxElements = document.querySelectorAll('.parallax');
            
            window.addEventListener('scroll', () => {
              const scrollY = window.scrollY;
              
              parallaxElements.forEach(el => {
                const speed = el.dataset.speed || 0.2;
                el.style.transform = \`translateY(\${scrollY * speed}px)\`;
              });
            });
          });
        `
      }} />
    </div>
  )
}
