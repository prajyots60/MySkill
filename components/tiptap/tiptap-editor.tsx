"use client"

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  PaintBucket,
  Highlighter,
  Undo,
  Redo,
  Table as TableIcon,
  Code,
  CheckSquare,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  Palette,
  X,
  MoreHorizontal,
  Sparkles,
  Type
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Type definition for the editor props
interface TiptapEditorProps {
  content: string | null
  onChange: (content: string) => void
  editable?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

// Color picker component
const ColorPicker = ({ 
  editor, 
  type = 'color' 
}: { 
  editor: Editor
  type?: 'color' | 'highlight'
}) => {
  const colors = [
    '#000000', '#333333', '#666666', '#999999', 
    '#1a73e8', '#4285f4', '#8ab4f8', '#c6dafc', 
    '#188038', '#34a853', '#81c995', '#ceead6', 
    '#c5221f', '#ea4335', '#f28b82', '#fad2cf', 
    '#f9ab00', '#fbbc04', '#fde293', '#fef0c3', 
    '#9334e6', '#a142f4', '#d7aefb', '#ede7f6'
  ]
  
  const isColorActive = (color: string) => {
    if (type === 'color') {
      return editor.isActive('textStyle', { color })
    }
    return editor.isActive('highlight', { color })
  }
  
  const setColor = (color: string) => {
    if (type === 'color') {
      editor.chain().focus().setColor(color).run()
    } else {
      editor.chain().focus().toggleHighlight({ color }).run()
    }
  }
  
  return (
    <div className="px-1 py-2">
      <div className="flex flex-wrap gap-1 max-w-[194px]">
        {colors.map((color) => (
          <button
            key={color}
            className={cn(
              "w-6 h-6 rounded-md border border-muted-foreground/20 transition-transform hover:scale-110",
              isColorActive(color) && "ring-2 ring-primary ring-offset-1"
            )}
            style={{ backgroundColor: color }}
            onClick={() => setColor(color)}
            title={type === 'color' ? "Text Color" : "Highlight Color"}
          />
        ))}
      </div>
    </div>
  )
}

// Menu bar component for the editor
const MenuBar = ({ editor }: { editor: Editor | null }) => {
  // States for popovers
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [isImageOpen, setIsImageOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [isTableOpen, setIsTableOpen] = useState(false)
  const [tableRows, setTableRows] = useState('3')
  const [tableCols, setTableCols] = useState('3')
  const [isHeadingOpen, setIsHeadingOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Check if the editor is available
  if (!editor) {
    return null
  }

  // Insert link in the editor
  const handleLinkInsert = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run()
      setLinkUrl('')
      setIsLinkOpen(false)
      toast({
        title: "Link added",
        description: "The link has been added to your text."
      })
    }
  }

  // Insert image in the editor
  const handleImageInsert = () => {
    if (imageUrl) {
      editor
        .chain()
        .focus()
        .setImage({ src: imageUrl, alt: imageAlt || 'Course image' })
        .run()
      setImageUrl('')
      setImageAlt('')
      setIsImageOpen(false)
      toast({
        title: "Image added",
        description: "The image has been added to your content."
      })
    }
  }

  // Insert table in the editor
  const handleTableInsert = () => {
    const rows = parseInt(tableRows, 10) || 3
    const cols = parseInt(tableCols, 10) || 3
    
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
    
    setIsTableOpen(false)
    toast({
      title: "Table added",
      description: `Added a table with ${rows} rows and ${cols} columns.`
    })
  }

  // Sparkles animation effect
  const applySparklesEffect = () => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 1500)
    
    // Also apply some formatting to make content more visually appealing
    editor
      .chain()
      .focus()
      .setColor('#4285f4')
      .toggleBold()
      .run()
    
    toast({
      title: "Magic formatting applied!",
      description: "Your text has been enhanced with a touch of magic."
    })
  }

  // Button for menu items with active state
  const MenuButton = ({ 
    onClick, 
    isActive = false,
    icon,
    title
  }: { 
    onClick: () => void, 
    isActive?: boolean,
    icon: React.ReactNode,
    title: string
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-9 p-0 rounded-md",
              isActive && "bg-muted text-primary"
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div className={cn(
      "border-b p-1 flex flex-wrap items-center gap-1 bg-muted/30 sticky top-0 z-10 transition-all duration-300 rounded-t-md",
      isAnimating && "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
    )}>
      <div className="flex flex-wrap items-center gap-1">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={<Bold className="h-4 w-4" />}
          title="Bold (Ctrl+B)"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={<Italic className="h-4 w-4" />}
          title="Italic (Ctrl+I)"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          icon={<UnderlineIcon className="h-4 w-4" />}
          title="Underline (Ctrl+U)"
        />
        
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
        
        {/* Heading dropdown menu */}
        <DropdownMenu open={isHeadingOpen} onOpenChange={setIsHeadingOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-2 gap-1 rounded-md",
                (editor.isActive('heading', { level: 1 }) || 
                editor.isActive('heading', { level: 2 }) || 
                editor.isActive('heading', { level: 3 })) && "bg-muted text-primary"
              )}
            >
              <Type className="h-4 w-4" />
              <span className="text-xs">Heading</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Text style</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={cn(
                "flex items-center gap-2 cursor-pointer", 
                editor.isActive('heading', { level: 1 }) && "bg-muted text-primary"
              )}
            >
              <Heading1 className="h-4 w-4" />
              <span>Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn(
                "flex items-center gap-2 cursor-pointer", 
                editor.isActive('heading', { level: 2 }) && "bg-muted text-primary"
              )}
            >
              <Heading2 className="h-4 w-4" />
              <span>Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn(
                "flex items-center gap-2 cursor-pointer", 
                editor.isActive('heading', { level: 3 }) && "bg-muted text-primary"
              )}
            >
              <Heading2 className="h-3.5 w-3.5" />
              <span>Heading 3</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                editor.isActive('paragraph') && "bg-muted text-primary"
              )}
            >
              <Type className="h-4 w-4" />
              <span>Normal text</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
        
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          icon={<List className="h-4 w-4" />}
          title="Bullet List"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          icon={<ListOrdered className="h-4 w-4" />}
          title="Numbered List"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          icon={<CheckSquare className="h-4 w-4" />}
          title="Task List"
        />
        
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
  
        {/* Text align buttons */}
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          icon={<AlignLeft className="h-4 w-4" />}
          title="Align Left"
        />
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          icon={<AlignCenter className="h-4 w-4" />}
          title="Align Center"
        />
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          icon={<AlignRight className="h-4 w-4" />}
          title="Align Right"
        />
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          icon={<AlignJustify className="h-4 w-4" />}
          title="Justify"
        />
        
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
  
        {/* Link button with popover */}
        <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 w-9 p-0 rounded-md",
                editor.isActive('link') && "bg-muted text-primary"
              )}
              title="Insert Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="flex flex-col space-y-2">
              <label htmlFor="link-url" className="text-sm font-medium">
                URL
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  id="link-url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLinkInsert()
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  onClick={handleLinkInsert}
                  className="flex-shrink-0"
                >
                  Add
                </Button>
              </div>
              {editor.isActive('link') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  className="mt-2"
                >
                  Remove Link
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
  
        {/* Image button with popover */}
        <Popover open={isImageOpen} onOpenChange={setIsImageOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-md"
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
            <div className="flex flex-col space-y-2">
              <label htmlFor="image-url" className="text-sm font-medium">
                Image URL
              </label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="mb-2"
              />
              <label htmlFor="image-alt" className="text-sm font-medium">
                Alt Text
              </label>
              <Input
                id="image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Image description"
                className="mb-2"
              />
              <Button
                type="submit"
                onClick={handleImageInsert}
              >
                Insert Image
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Table button with popover */}
        <Popover open={isTableOpen} onOpenChange={setIsTableOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 w-9 p-0 rounded-md",
                editor.isActive('table') && "bg-muted text-primary"
              )}
              title="Insert Table"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between">
                <label htmlFor="table-rows" className="text-sm font-medium">
                  Rows
                </label>
                <label htmlFor="table-cols" className="text-sm font-medium">
                  Columns
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="table-rows"
                  type="number"
                  min="1"
                  max="10"
                  value={tableRows}
                  onChange={(e) => setTableRows(e.target.value)}
                  className="w-full"
                />
                <Input
                  id="table-cols"
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                type="submit"
                onClick={handleTableInsert}
                className="mt-2"
              >
                Insert Table
              </Button>
              
              {editor.isActive('table') && (
                <div className="flex flex-col gap-2 mt-2 border-t pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                  >
                    Add Column Before
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                  >
                    Add Column After
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                  >
                    Add Row Before
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    Add Row After
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                  >
                    Delete Column
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => editor.chain().focus().deleteRow().run()}
                  >
                    Delete Row
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => editor.chain().focus().deleteTable().run()}
                  >
                    Delete Table
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
  
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
  
        {/* Code block button */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          icon={<Code className="h-4 w-4" />}
          title="Code Block"
        />
  
        {/* Color picker dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-md"
              title="Text Color"
            >
              <PaintBucket className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-auto p-1">
            <Tabs defaultValue="color" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="color" className="text-xs">Text</TabsTrigger>
                <TabsTrigger value="highlight" className="text-xs">Highlight</TabsTrigger>
              </TabsList>
              <TabsContent value="color" className="mt-1">
                <ColorPicker editor={editor} type="color" />
              </TabsContent>
              <TabsContent value="highlight" className="mt-1">
                <ColorPicker editor={editor} type="highlight" />
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
        
        {/* Superscript and Subscript */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          isActive={editor.isActive('superscript')}
          icon={<SuperscriptIcon className="h-4 w-4" />}
          title="Superscript"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          isActive={editor.isActive('subscript')}
          icon={<SubscriptIcon className="h-4 w-4" />}
          title="Subscript"
        />
        
        {/* Magic button with animation */}
        <Button
          onClick={applySparklesEffect}
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 w-9 p-0 rounded-md ml-1 transition-all duration-300",
            isAnimating && "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-lg rotate-3"
          )}
          title="Magic Formatting"
        >
          <Sparkles className={cn("h-4 w-4", isAnimating && "animate-pulse")} />
        </Button>
  
        <div className="h-4 w-px bg-muted-foreground/20 mx-1" />
  
        {/* More actions dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-md"
              title="More Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>More actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={cn("cursor-pointer", editor.isActive('blockquote') && "bg-muted text-primary")}
            >
              Blockquote
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn("cursor-pointer", editor.isActive('code') && "bg-muted text-primary")}
            >
              Inline Code
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="cursor-pointer"
            >
              Horizontal Rule
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().setHardBreak().run()}
              className="cursor-pointer"
            >
              Line Break
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
              className="cursor-pointer"
            >
              Clear Formatting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="ml-auto flex items-center gap-1">
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={<Undo className="h-4 w-4" />}
          title="Undo"
        />
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={<Redo className="h-4 w-4" />}
          title="Redo"
        />
      </div>
    </div>
  )
}

// Main Tiptap editor component
const TiptapEditor = ({
  content,
  onChange,
  editable = true,
  placeholder = 'Start typing your content...',
  autoFocus = false,
  className,
}: TiptapEditorProps) => {
  const editorRef = useRef<{ editor: Editor | null }>({ editor: null })
  const [wordCount, setWordCount] = useState({ characters: 0, words: 0 })

  // Count words and characters in HTML content
  const countWordsAndCharacters = (html: string) => {
    // Strip HTML tags for accurate counting
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return {
      characters: text.length,
      words: text.split(/\s+/).filter(Boolean).length
    }
  }

  // Initialize editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4 hover:text-primary/80 transition-colors',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'mx-auto rounded-md max-w-full my-4 shadow-md hover:shadow-lg transition-shadow',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Superscript,
      Subscript,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-border w-full my-4',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted font-medium p-2',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-2',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-2',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'flex gap-2 items-start my-2',
        },
        nested: true,
      }),
      Typography,
    ],
    content: content || '',
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      // Update word count
      setWordCount(countWordsAndCharacters(html))
    },
  })

  // Store the editor instance in the ref for accessibility
  useEffect(() => {
    if (editor) {
      editorRef.current.editor = editor
    }
  }, [editor])

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== null && editor.getHTML() !== content) {
      try {
        editor.commands.setContent(content || '')
        // Update word count
        setWordCount(countWordsAndCharacters(content || ''))
      } catch (error) {
        console.error('Error setting editor content:', error)
      }
    }
  }, [content, editor])

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editor || !event.ctrlKey) return
      
      // Ctrl+B for bold
      if (event.key === 'b') {
        event.preventDefault()
        editor.chain().focus().toggleBold().run()
      }
      
      // Ctrl+I for italic
      if (event.key === 'i') {
        event.preventDefault()
        editor.chain().focus().toggleItalic().run()
      }
      
      // Ctrl+U for underline
      if (event.key === 'u') {
        event.preventDefault()
        editor.chain().focus().toggleUnderline().run()
      }
    }
    
    if (editor && editable) {
      document.addEventListener('keydown', handleKeyDown)
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, editable])

  return (
    <div className={cn('relative border rounded-md overflow-hidden', className)}>
      {editable && editor && <MenuBar editor={editor} />}
      <EditorContent
        editor={editor}
        className={cn(
          'prose max-w-none w-full focus:outline-none p-4',
          'prose-h1:mt-4 prose-h1:mb-2 prose-h1:text-2xl',
          'prose-h2:mt-3 prose-h2:mb-2 prose-h2:text-xl',
          'prose-h3:mt-3 prose-h3:mb-2 prose-h3:text-lg',
          'prose-p:my-2',
          'prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-1',
          'prose-img:my-4 prose-img:rounded-md',
          'prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-code:p-1 prose-code:bg-muted prose-code:rounded-md prose-code:text-sm',
          'prose-pre:bg-muted prose-pre:rounded-md prose-pre:p-4 prose-pre:my-4',
          !editable && 'p-0',
        )}
      />
      
      {/* Bottom toolbar with word count and other info */}
      {editable && editor && (
        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <div>
            {wordCount.characters} characters
            {' • '}
            {wordCount.words} words
          </div>
          <div className="flex items-center gap-2">
            {editor.isActive('heading', { level: 1 }) && <span>Heading 1</span>}
            {editor.isActive('heading', { level: 2 }) && <span>Heading 2</span>}
            {editor.isActive('heading', { level: 3 }) && <span>Heading 3</span>}
            {editor.isActive('paragraph') && <span>Paragraph</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export { TiptapEditor }