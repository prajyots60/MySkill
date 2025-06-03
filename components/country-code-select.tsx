"use client"

import * as React from "react"
import { Phone, CheckIcon, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Popular country codes list with country names, codes, dial codes, and emoji flags
// Re-ordered to put India at the top and fix the display of countries with the same dial code
const countryCodes = [
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "United States", code: "US", dialCode: "+1 US", flag: "🇺🇸" },
  { name: "Canada", code: "CA", dialCode: "+1 CA", flag: "🇨🇦" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "Russia", code: "RU", dialCode: "+7", flag: "🇷🇺" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪" },
  { name: "Argentina", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Austria", code: "AT", dialCode: "+43", flag: "🇦🇹" },
  { name: "Belgium", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Chile", code: "CL", dialCode: "+56", flag: "🇨🇱" },
  { name: "Colombia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Czech Republic", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
  { name: "Denmark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Finland", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "Greece", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
  { name: "Hungary", code: "HU", dialCode: "+36", flag: "🇭🇺" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "Israel", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾" },
  { name: "Norway", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
  { name: "Peru", code: "PE", dialCode: "+51", flag: "🇵🇪" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "Poland", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Romania", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦" },
  { name: "Sweden", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
  { name: "Thailand", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Turkey", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flag: "🇺🇦" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" }
]

// For storing the clean dial codes for value storage
const dialCodeMap = {
  "+1 US": "+1", 
  "+1 CA": "+1"
}

interface CountryCodeSelectProps {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  className?: string
  inputClassName?: string
  selectClassName?: string
  placeholder?: string
  helperText?: string
}

export function CountryCodeSelect({
  value = "",
  onChange,
  label = "Mobile Number",
  required = false,
  className = "",
  inputClassName = "",
  selectClassName = "",
  placeholder = "Phone Number",
  helperText = "",
}: CountryCodeSelectProps) {
  // Parse the current value into country code and phone number
  const [countryCode, setCountryCode] = React.useState<string>(
    () => {
      // If already has a value, try to match it
      if (value) {
        const match = value.match(/^\+\d+/)
        if (match) {
          // Check if this is a +1 code (US or Canada)
          if (match[0] === "+1") {
            // Try to determine if US or Canada based on value, default to US
            return value.toLowerCase().includes("ca") ? "+1 CA" : "+1 US"
          }
          return match[0]
        }
      }
      return "+91" // Default to India
    }
  )

  const [phoneNumber, setPhoneNumber] = React.useState<string>(
    () => {
      const match = value.match(/^\+\d+\s*(.*)$/)
      return match ? match[1] : value
    }
  )
  
  // Ensure we display the correct country code in the UI
  React.useEffect(() => {
    if (value) {
      const match = value.match(/^\+(\d+)\s*(.*)$/)
      if (match) {
        const dialCode = `+${match[1]}`
        const number = match[2] || ""
        
        // For +1 code, check if we should display US or CA
        if (dialCode === "+1") {
          const codeToUse = value.toLowerCase().includes("ca") ? "+1 CA" : "+1 US"
          if (codeToUse !== countryCode) {
            setCountryCode(codeToUse)
          }
        } else {
          // For other codes, check if they are in our list
          const country = countryCodes.find(c => c.dialCode.startsWith(dialCode))
          if (country && country.dialCode !== countryCode) {
            setCountryCode(country.dialCode)
          }
        }
        
        if (number !== phoneNumber) {
          setPhoneNumber(number)
        }
      }
    }
  }, [value])

  // Update the parent component when either part changes
  const updateParent = React.useCallback((code: string, number: string) => {
    // Convert display code (like +1 US) to actual dial code (+1) for storage
    const actualCode = dialCodeMap[code] || code
    onChange(`${actualCode} ${number}`.trim())
  }, [onChange])

  // Handle country code change
  const handleCountryCodeChange = (newCode: string) => {
    setCountryCode(newCode)
    updateParent(newCode, phoneNumber)
  }

  // Handle phone number change
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value)
    updateParent(countryCode, e.target.value)
  }

  // State for search functionality
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Filter countries based on search query
  const filteredCountries = React.useMemo(() => {
    if (!searchQuery) return countryCodes;
    const query = searchQuery.toLowerCase();
    return countryCodes.filter(
      country => 
        country.name.toLowerCase().includes(query) || 
        country.dialCode.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get current country data for display in the trigger
  const currentCountry = React.useMemo(() => {
    // Handle special cases for +1 codes first
    if (countryCode === "+1 US" || countryCode === "+1 CA") {
      return countryCodes.find(c => c.dialCode === countryCode);
    }
    // For other codes
    return countryCodes.find(c => c.dialCode === countryCode || c.dialCode.startsWith(countryCode));
  }, [countryCode]);
  
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor="phoneNumber" className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
          {label}
        </Label>
      )}
      <div className="flex items-center space-x-2">
        <div className="w-[110px]">
          <Select value={countryCode} onValueChange={handleCountryCodeChange}>
            <SelectTrigger className={cn(
              "flex-shrink-0 h-10 pl-2 pr-2 gap-1 group",
              "border-input bg-background hover:bg-accent hover:text-accent-foreground",
              "transition-colors focus:ring-1 focus:ring-ring",
              selectClassName
            )}>
              {currentCountry && (
                <>
                  <span className="text-lg mr-1">{currentCountry.flag}</span>
                  <SelectValue placeholder="+91">
                    <span className="font-medium">{currentCountry.dialCode.split(' ')[0]}</span>
                  </SelectValue>
                </>
              )}
            </SelectTrigger>
            <SelectContent className="min-w-[280px] p-0 overflow-hidden">
              <div className="sticky top-0 z-10 bg-background border-b p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search countries..." 
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-auto py-1">
                {filteredCountries.map((country) => (
                  <SelectItem 
                    key={country.code} 
                    value={country.dialCode}
                    className="flex py-2.5 px-3 cursor-pointer hover:bg-accent focus:bg-accent active:bg-accent"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold">{country.name}</span>
                          <span className="text-sm text-muted-foreground">{country.dialCode.split(' ')[0]}</span>
                        </div>
                      </div>
                      {country.dialCode === countryCode && (
                        <CheckIcon className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </SelectItem>
                ))}
                {filteredCountries.length === 0 && (
                  <div className="py-6 text-center text-muted-foreground">
                    No countries found
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            id="phoneNumber"
            className={cn(
              "pl-9 h-10 border-input bg-background hover:border-accent transition-colors",
              "focus:ring-1 focus:ring-ring",
              inputClassName
            )}
            placeholder={placeholder}
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
          />
        </div>
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}
    </div>
  )
}
