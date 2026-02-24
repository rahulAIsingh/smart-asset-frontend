import React, { useState } from 'react'
import {
  User,
  Bell,
  Shield,
  Globe,
  Mail,
  Compass,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import { Button } from '../components/ui/button'
import { useAuth } from '../hooks/useAuth'
import { dataClient } from '../lib/dataClient'
import { toast } from 'sonner'
import { useOnboarding } from '../onboarding/useOnboarding'

export function Settings() {
  const { user } = useAuth()
  const { restartTour } = useOnboarding()
  const [activeTab, setActiveTab] = useState('profile')
  const [testEmailTo, setTestEmailTo] = useState((user?.email || '').trim())
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<string>('')

  const runEmailTest = async () => {
    const to = testEmailTo.trim()
    if (!to || !to.includes('@')) {
      toast.error('Enter a valid test email address')
      return
    }

    setTestingEmail(true)
    setEmailTestResult('')
    try {
      const result = await dataClient.notifications.testEmail({ to })
      setEmailTestResult(result?.message || 'Test email sent successfully.')
      toast.success(result?.message || 'Test email sent successfully.')
    } catch (error: any) {
      const detail = error?.detail || error?.message || 'Unknown email error'
      const inner = error?.inner ? ` | ${error.inner}` : ''
      const full = `${detail}${inner}`
      setEmailTestResult(`Failed: ${full}`)
      toast.error(`Email test failed: ${full}`)
    } finally {
      setTestingEmail(false)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
      default:
        return (
          <>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Manage your public profile and identity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-2xl border border-dashed border-border">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-4 border-background shadow-inner">
                    {user?.displayName?.[0] || user?.email?.[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold">{user?.displayName || 'Admin User'}</h4>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-primary font-medium mt-1">Administrator Access</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl">Change Avatar</Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input className="w-full px-4 py-2 bg-muted/50 border-none rounded-xl text-sm" defaultValue={user?.displayName || ''} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <input className="w-full px-4 py-2 bg-muted/50 border-none rounded-xl text-sm" defaultValue={user?.email || ''} readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose how you want to be notified about asset events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive alerts on asset issuance and returns.</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="p-4 bg-muted/20 rounded-xl space-y-3 border border-border/50">
                  <p className="text-sm font-semibold">SMTP Test</p>
                  <p className="text-xs text-muted-foreground">Send a test mail and view exact SMTP error details.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm"
                      placeholder="recipient@company.com"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                    />
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={runEmailTest}
                      disabled={testingEmail}
                    >
                      {testingEmail ? 'Testing...' : 'Send Test Email'}
                    </Button>
                  </div>
                  {emailTestResult ? (
                    <p className="text-xs text-muted-foreground break-all">{emailTestResult}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50" data-tour="settings-onboarding-card">
              <CardHeader>
                <CardTitle>Onboarding</CardTitle>
                <CardDescription>Replay the guided walkthrough for your current role.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="ftux-restart-settings"
                  onClick={() => restartTour()}
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Restart Tour
                </Button>
              </CardContent>
            </Card>
          </>
        )
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and portal configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold px-1">Categories</h3>
          <div className="space-y-1">
            {[
              { id: 'profile', icon: User, label: 'Profile' },
              { id: 'notifications', icon: Bell, label: 'Notifications' },
              { id: 'security', icon: Shield, label: 'Security' },
              { id: 'regional', icon: Globe, label: 'Regional' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
