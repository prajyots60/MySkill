"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail, Instagram, Twitter, Linkedin, Youtube, Facebook, ExternalLink } from "lucide-react"

interface CreatorFooterProps {
  creatorName: string;
  themeColor?: string;
}

const CreatorFooter: React.FC<CreatorFooterProps> = ({ 
  creatorName,
  themeColor = "default"
}) => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="mt-20 pt-12 border-t">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">{creatorName}'s Academy</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Join our community of learners and unlock your potential with our expert-led courses.
              Discover a world of knowledge at your fingertips.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Mail className="w-4 h-4 mr-2" />
                Contact
              </Button>
              <Button 
                variant="default" 
                size="sm"
                className={`bg-${themeColor !== 'default' ? themeColor + '-500' : 'primary'} hover:bg-${themeColor !== 'default' ? themeColor + '-600' : 'primary/90'}`}
              >
                Browse Courses
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Courses
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Community
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-md font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Accessibility
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between py-6 border-t">
          <p className="text-sm text-muted-foreground mb-4 md:mb-0">
            © {currentYear} {creatorName}'s Academy. All rights reserved.
          </p>
          
          <div className="flex gap-4">
            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Instagram">
              <Instagram className="w-5 h-5" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
              <Twitter className="w-5 h-5" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
              <Linkedin className="w-5 h-5" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="YouTube">
              <Youtube className="w-5 h-5" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Facebook">
              <Facebook className="w-5 h-5" />
            </Link>
          </div>
          
          <div className="flex items-center mt-4 md:mt-0 text-xs text-muted-foreground">
            <Link href="/" className="hover:underline flex items-center">
              Powered by EduFlow
              <ExternalLink className="ml-1 w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default CreatorFooter