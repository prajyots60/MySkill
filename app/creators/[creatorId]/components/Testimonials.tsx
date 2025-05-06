"use client"

import React, { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star, ChevronLeft, ChevronRight, User, Quote } from "lucide-react"
import { Testimonial } from "../types/creator.types"

interface TestimonialsProps {
  testimonials: Testimonial[];
  themeColor?: string;
  layout?: "grid" | "carousel" | "list";
}

const Testimonials: React.FC<TestimonialsProps> = ({
  testimonials,
  themeColor = "default",
  layout = "grid"
}) => {
  const [activeIndex, setActiveIndex] = useState(0)
  
  if (!testimonials || testimonials.length === 0) {
    return (
      <div className="text-center py-12">
        <Quote className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No testimonials yet</h3>
        <p className="text-muted-foreground">
          The creator hasn't received any testimonials yet.
        </p>
      </div>
    )
  }

  // Handler for previous button
  const prevTestimonial = () => {
    setActiveIndex(prev => (prev === 0 ? testimonials.length - 1 : prev - 1))
  }
  
  // Handler for next button
  const nextTestimonial = () => {
    setActiveIndex(prev => (prev === testimonials.length - 1 ? 0 : prev + 1))
  }
  
  // Theme gradient colors
  const themeClasses = {
    default: "from-primary/5 via-primary/10 to-transparent",
    blue: "from-blue-500/5 via-blue-500/10 to-transparent",
    green: "from-green-500/5 via-green-500/10 to-transparent",
    purple: "from-purple-500/5 via-purple-500/10 to-transparent",
    amber: "from-amber-500/5 via-amber-500/10 to-transparent",
    rose: "from-rose-500/5 via-rose-500/10 to-transparent",
  }
  
  const gradientClass = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses.default

  // Rating stars component
  const RatingStars = ({ rating }: { rating: number }) => (
    <div className="flex items-center">
      {Array(5).fill(0).map((_, i) => (
        <Star 
          key={i} 
          className={`h-4 w-4 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} 
        />
      ))}
    </div>
  )
  
  // Grid layout
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className={`bg-gradient-to-br ${gradientClass} border-transparent`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarImage src={testimonial.image} alt={testimonial.name} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.title}</div>
                </div>
              </div>
              
              <blockquote className="border-l-2 pl-4 italic text-muted-foreground">
                "{testimonial.content}"
              </blockquote>
              
              <div className="mt-4">
                <RatingStars rating={testimonial.rating} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  // Carousel layout
  if (layout === "carousel") {
    return (
      <div className="relative">
        <Card className={`bg-gradient-to-br ${gradientClass} border-transparent`}>
          <CardContent className="pt-6 px-8 md:px-12">
            <Quote className="h-10 w-10 text-primary/40 mb-4" />
            <div className="text-xl md:text-2xl font-medium mb-6 text-center">
              "{testimonials[activeIndex].content}"
            </div>
            
            <div className="flex flex-col items-center justify-center gap-2 mt-8">
              <Avatar className="h-16 w-16">
                <AvatarImage 
                  src={testimonials[activeIndex].image} 
                  alt={testimonials[activeIndex].name}
                />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="font-semibold mt-2">{testimonials[activeIndex].name}</div>
                <div className="text-sm text-muted-foreground">{testimonials[activeIndex].title}</div>
                <div className="flex justify-center mt-2">
                  <RatingStars rating={testimonials[activeIndex].rating} />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-2 pb-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === activeIndex 
                    ? 'bg-primary w-4' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </CardFooter>
        </Card>
        
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 hover:bg-background/80 rounded-full"
          onClick={prevTestimonial}
          aria-label="Previous testimonial"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-background/80 rounded-full"
          onClick={nextTestimonial}
          aria-label="Next testimonial"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    )
  }
  
  // List layout
  return (
    <div className="space-y-6">
      {testimonials.map((testimonial, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="pt-6 flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center md:items-start md:w-1/3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={testimonial.image} alt={testimonial.name} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left mt-3">
                <div className="font-medium">{testimonial.name}</div>
                <div className="text-sm text-muted-foreground">{testimonial.title}</div>
                <div className="mt-2">
                  <RatingStars rating={testimonial.rating} />
                </div>
              </div>
            </div>
            
            <div className="md:w-2/3">
              <blockquote className="border-l-2 pl-4 italic text-muted-foreground">
                "{testimonial.content}"
              </blockquote>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default Testimonials