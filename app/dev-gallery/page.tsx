"use client"

import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { PostCard } from "@/components/postCard"
import { Logo } from "@/components/logo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/toaster"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border pb-10">
      <h2 className="text-xl font-bold tracking-wide">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

export default function ComponentGalleryPage() {
  const [sliderValue, setSliderValue] = useState([40])
  const { toast } = useToast()

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl space-y-10 p-8">
        <h1 className="text-3xl font-bold tracking-wide">UI Component Gallery</h1>
        <p className="text-muted-foreground">
          Every primitive still in active use in components/ui, rendered with sample data. Unused
          primitives were removed from the codebase; a handful (Sheet, Skeleton, Toast, Tooltip) were
          kept in reserve for near-term features.
        </p>

        <Section title="button.tsx">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Section>

        <Section title="badge.tsx">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="muted">Muted</Badge>
        </Section>

        <Section title="logo.tsx">
          <Logo className="size-24" />
          <Logo className="size-10" />
        </Section>

        <Section title="card.tsx">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Supporting description text.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Body content goes here.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="postCard.tsx">
          <div className="w-[500px]">
            <PostCard
              post={{
                id: "demo-1",
                club_id: "demo-club",
                club_name: "Sequential Arts Club",
                club_avatar: "/icon-512.png",
                title: "GOAT and Hoppers",
                author_name: "Leila DiPiazza",
                author_email: "leila@example.com",
                content:
                  "Hey everyone, we still have club today in G116! I'll be putting on two different animated movie trailers: GOAT and Hoppers! I think they're both pretty cool, and we can talk about if one seems more compelling than the other due to the animation :)\n\nhope to see you all there!\n-Sequential Arts Club",
                image_url: null,
                likes_count: 4,
                comments_count: 0,
                created_at: new Date().toISOString(),
                isLiked: false,
              }}
              onLike={() => {}}
            />
          </div>
        </Section>

        <Section title="alert.tsx">
          <Alert className="w-96">
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>This is a standard alert message.</AlertDescription>
          </Alert>
          <Alert variant="destructive" className="w-96">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </Section>

        <Section title="input.tsx / textarea.tsx / label.tsx">
          <div className="grid w-64 gap-1.5">
            <Label htmlFor="gallery-input">Email</Label>
            <Input id="gallery-input" placeholder="you@school.edu" />
          </div>
          <div className="grid w-64 gap-1.5">
            <Label htmlFor="gallery-textarea">Message</Label>
            <Textarea id="gallery-textarea" placeholder="Write something..." />
          </div>
        </Section>

        <Section title="checkbox.tsx / switch.tsx / radio-group.tsx">
          <div className="flex items-center gap-2">
            <Checkbox id="gallery-checkbox" />
            <Label htmlFor="gallery-checkbox">Accept terms</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="gallery-switch" />
            <Label htmlFor="gallery-switch">Notifications</Label>
          </div>
          <RadioGroup defaultValue="a" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="a" id="r-a" />
              <Label htmlFor="r-a">Option A</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="b" id="r-b" />
              <Label htmlFor="r-b">Option B</Label>
            </div>
          </RadioGroup>
        </Section>

        <Section title="slider.tsx">
          <div className="w-64 space-y-2">
            <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
            <p className="text-sm text-muted-foreground">{sliderValue[0]}%</p>
          </div>
        </Section>

        <Section title="select.tsx">
          <Select defaultValue="clubs">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choose a page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="clubs">Clubs</SelectItem>
              <SelectItem value="lost-found">Lost & Found</SelectItem>
            </SelectContent>
          </Select>
        </Section>

        <Section title="tabs.tsx">
          <Tabs defaultValue="tab1" className="w-72">
            <TabsList>
              <TabsTrigger value="tab1">Tab One</TabsTrigger>
              <TabsTrigger value="tab2">Tab Two</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">Content for tab one.</TabsContent>
            <TabsContent value="tab2">Content for tab two.</TabsContent>
          </Tabs>
        </Section>

        <Section title="dialog.tsx / alert-dialog.tsx / sheet.tsx">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>Dialog description text.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Open Alert Dialog</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Sheet title</SheetTitle>
            </SheetContent>
          </Sheet>
        </Section>

        <Section title="dropdown-menu.tsx">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="tooltip.tsx">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip target</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </Section>

        <Section title="toast.tsx">
          <Button
            variant="outline"
            onClick={() =>
              toast({ title: "Saved", description: "Your changes have been saved." })
            }
          >
            Trigger Toast
          </Button>
        </Section>

        <Section title="skeleton.tsx / separator.tsx / scroll-area.tsx">
          <div className="w-48 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Separator orientation="vertical" className="h-10" />
          <ScrollArea className="h-24 w-48">
            <div className="px-4 py-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <p key={i} className="text-sm">
                  Scrollable line {i + 1}
                </p>
              ))}
            </div>
          </ScrollArea>
        </Section>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}
