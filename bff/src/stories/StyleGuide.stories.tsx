import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { buttons, forms, tabs, cards } from '@/lib/design-system';
import { Badge } from '@/components/ui/badge';
import { StyledCard, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/styled-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Shield, Activity } from 'lucide-react';

const meta: Meta = {
  title: 'Style Guide/Overview',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ColorPalette: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">BeTrace Brand Colors</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="h-24 bg-blue-600 rounded-lg"></div>
            <p className="text-sm font-medium">Primary Blue</p>
            <p className="text-xs text-gray-500">bg-blue-600</p>
          </div>
          <div className="space-y-2">
            <div className="h-24 bg-emerald-500 rounded-lg"></div>
            <p className="text-sm font-medium">Success</p>
            <p className="text-xs text-gray-500">bg-emerald-500</p>
          </div>
          <div className="space-y-2">
            <div className="h-24 bg-amber-500 rounded-lg"></div>
            <p className="text-sm font-medium">Warning</p>
            <p className="text-xs text-gray-500">bg-amber-500</p>
          </div>
          <div className="space-y-2">
            <div className="h-24 bg-red-500 rounded-lg"></div>
            <p className="text-sm font-medium">Danger</p>
            <p className="text-xs text-gray-500">bg-red-500</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Neutral Palette</h3>
        <div className="grid grid-cols-6 gap-4">
          <div className="space-y-2">
            <div className="h-16 bg-gray-50 rounded border border-gray-300"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400">gray-50</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-100 rounded border border-gray-300"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400">gray-100</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-200 rounded border border-gray-300"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400">gray-200</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-300 rounded border border-gray-400"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400">gray-300</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-400 rounded border border-gray-500"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400">gray-400</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-500 rounded border border-gray-600"></div>
            <p className="text-xs text-gray-100">gray-500</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-600 rounded border border-gray-700"></div>
            <p className="text-xs text-gray-100">gray-600</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-700 rounded border border-gray-800"></div>
            <p className="text-xs text-gray-100">gray-700</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-800 rounded border border-gray-900"></div>
            <p className="text-xs text-gray-100">gray-800</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-900 rounded border border-gray-950"></div>
            <p className="text-xs text-gray-100">gray-900</p>
          </div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-950 rounded border border-black"></div>
            <p className="text-xs text-gray-100">gray-950</p>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Typography System</h2>

      <div className="space-y-4">
        <div>
          <h1 className="text-4xl font-bold">Heading 1 - 36px Bold</h1>
          <code className="text-sm text-gray-500">text-4xl font-bold</code>
        </div>
        <div>
          <h2 className="text-3xl font-bold">Heading 2 - 30px Bold</h2>
          <code className="text-sm text-gray-500">text-3xl font-bold</code>
        </div>
        <div>
          <h3 className="text-2xl font-semibold">Heading 3 - 24px Semibold</h3>
          <code className="text-sm text-gray-500">text-2xl font-semibold</code>
        </div>
        <div>
          <h4 className="text-xl font-semibold">Heading 4 - 20px Semibold</h4>
          <code className="text-sm text-gray-500">text-xl font-semibold</code>
        </div>
        <div>
          <h5 className="text-lg font-medium">Heading 5 - 18px Medium</h5>
          <code className="text-sm text-gray-500">text-lg font-medium</code>
        </div>
        <div>
          <p className="text-base">Body Text - 16px Regular</p>
          <code className="text-sm text-gray-500">text-base</code>
        </div>
        <div>
          <p className="text-sm text-gray-600">Small Text - 14px</p>
          <code className="text-sm text-gray-500">text-sm text-gray-600</code>
        </div>
        <div>
          <p className="text-xs text-gray-500">Caption - 12px</p>
          <code className="text-sm text-gray-500">text-xs text-gray-500</code>
        </div>
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Spacing Scale</h2>

      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((space) => (
          <div key={space} className="flex items-center gap-4">
            <code className="text-sm text-gray-500 w-16">p-{space}</code>
            <div className={`bg-blue-500 text-white p-${space} rounded`}>
              {space * 4}px
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">Button Components</h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Variants</h3>
          <div className="flex gap-4 flex-wrap">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">Default (Primary)</Button>
            <Button variant="secondary" className="bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">Secondary</Button>
            <Button variant="outline" className="border-2 border-gray-300 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800">Outline</Button>
            <Button variant="ghost" className="text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800">Ghost</Button>
            <Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700">Destructive</Button>
            <Button variant="link" className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400">Link</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sizes</h3>
          <div className="flex gap-4 items-center">
            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">Small</Button>
            <Button size="default" className="bg-blue-600 text-white hover:bg-blue-700">Default</Button>
            <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">Large</Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">With Icons</h3>
          <div className="flex gap-4 flex-wrap">
            <Button className="bg-blue-600 text-white hover:bg-blue-700">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </Button>
            <Button variant="outline" className="border-2 border-gray-300 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800">
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">States</h3>
          <div className="flex gap-4">
            <Button>Normal</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Badge Components</h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Status Badges</h3>
          <div className="flex gap-4">
            <Badge className="bg-red-500 text-white">
              <AlertCircle className="w-3 h-3 mr-1" />
              Open
            </Badge>
            <Badge className="bg-amber-500 text-white">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Investigating
            </Badge>
            <Badge className="bg-emerald-500 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolved
            </Badge>
            <Badge className="bg-gray-500 text-white">
              <Info className="w-3 h-3 mr-1" />
              False Positive
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Severity Badges</h3>
          <div className="flex gap-4">
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              CRITICAL
            </Badge>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              HIGH
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              <Shield className="w-3 h-3 mr-1" />
              MEDIUM
            </Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
              <Activity className="w-3 h-3 mr-1" />
              LOW
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Default Variants</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Badge variants with proper contrast for different use cases
          </p>
          <div className="flex gap-4 flex-wrap items-center">
            <div className="space-y-1">
              <Badge className="bg-blue-600 text-white border-blue-700">Default (Primary)</Badge>
              <p className="text-xs text-gray-500">Blue background, white text</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary" className="bg-gray-100 text-gray-900 border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">Secondary</Badge>
              <p className="text-xs text-gray-500">Gray background, dark text</p>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="border-gray-300 text-gray-900 dark:border-gray-600 dark:text-gray-100">Outline</Badge>
              <p className="text-xs text-gray-500">Border only, inherits text</p>
            </div>
            <div className="space-y-1">
              <Badge variant="destructive" className="bg-red-600 text-white border-red-700">Destructive</Badge>
              <p className="text-xs text-gray-500">Red background, white text</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Cards: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">BeTrace Card Components</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        BeTrace uses StyledCard with design system variants for consistent styling
      </p>

      <div className="grid grid-cols-2 gap-6">
        <StyledCard variant="default">
          <CardHeader>
            <CardTitle>Default Card</CardTitle>
            <CardDescription>Standard card with BeTrace design system styling</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is the default card component used throughout the BeTrace interface with consistent borders and styling.
            </p>
          </CardContent>
        </StyledCard>

        <StyledCard variant="default">
          <CardHeader>
            <CardTitle>Card with Footer</CardTitle>
            <CardDescription>Includes action buttons</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cards can have footers for actions with BeTrace button styling.
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" className={buttons.softOutline}>Cancel</Button>
            <Button>Confirm</Button>
          </CardFooter>
        </StyledCard>

        <StyledCard variant="success">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Success Card</span>
              <Badge className="bg-emerald-500 text-white">Active</Badge>
            </CardTitle>
            <CardDescription>Green-themed card for positive states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Total Signals</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">1,234</p>
              </div>
              <div className="p-3 bg-emerald-200 dark:bg-emerald-900 rounded-lg">
                <Activity className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </StyledCard>

        <StyledCard variant="error">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200">Error Card</CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">Critical security issue detected</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 dark:text-red-300">
              This card variant is used for critical alerts and error states.
            </p>
          </CardContent>
        </StyledCard>

        <StyledCard variant="warning">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">Warning Card</CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400">Important information requires attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This card variant is used for warnings and important notices.
            </p>
          </CardContent>
        </StyledCard>
      </div>
    </div>
  ),
};

export const Forms: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Form Components</h2>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="user@example.com" className={forms.input} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="Enter password" className={forms.input} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select>
            <SelectTrigger id="status" className={forms.select}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" placeholder="Enter a detailed description..." rows={4} className={forms.textarea} />
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="notifications" />
          <Label htmlFor="notifications">Enable email notifications</Label>
        </div>

        <div className="space-y-2">
          <Label>Input States</Label>
          <div className="space-y-2">
            <Input placeholder="Normal input" className={forms.input} />
            <Input placeholder="Disabled input" disabled className={forms.input} />
            <Input placeholder="Error state" className={forms.inputError} />
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Alerts: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Alert Components</h2>

      <div className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">Information</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            This is an informational alert with helpful details for the user.
          </AlertDescription>
        </Alert>

        <Alert className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-200">Success!</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            Your operation completed successfully.
          </AlertDescription>
        </Alert>

        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Warning</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Please review this important information before proceeding.
          </AlertDescription>
        </Alert>

        <Alert className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-200">Error</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            There was a problem processing your request. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  ),
};

export const TabsComponent: Story = {
  render: () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-6">Tabs Component</h2>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={tabs.list}>
          <TabsTrigger value="overview" className={tabs.trigger}>Overview</TabsTrigger>
          <TabsTrigger value="details" className={tabs.trigger}>Details</TabsTrigger>
          <TabsTrigger value="analytics" className={tabs.trigger}>Analytics</TabsTrigger>
          <TabsTrigger value="settings" className={tabs.trigger}>Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className={`${tabs.content} space-y-4`}>
          <h3 className="text-lg font-semibold">Overview Tab</h3>
          <p>This is the overview content. Tabs are used to organize related content into separate views.</p>
        </TabsContent>
        <TabsContent value="details" className={`${tabs.content} space-y-4`}>
          <h3 className="text-lg font-semibold">Details Tab</h3>
          <p>Detailed information would be displayed here.</p>
        </TabsContent>
        <TabsContent value="analytics" className={`${tabs.content} space-y-4`}>
          <h3 className="text-lg font-semibold">Analytics Tab</h3>
          <p>Analytics and metrics would be shown in this tab.</p>
        </TabsContent>
        <TabsContent value="settings" className={`${tabs.content} space-y-4`}>
          <h3 className="text-lg font-semibold">Settings Tab</h3>
          <p>Configuration options would be available here.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};