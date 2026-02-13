import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card'
import { Lock, User, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { blink } from '../lib/blink'

export function Login() {
    const navigate = useNavigate()
    const { devLogin, login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleDevLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        if (password === '123') {
            if (email === 'admin' || email === 'admin@demo.com') {
                devLogin('admin@demo.com', 'admin')
                toast.success('Welcome back, Admin!')
                navigate('/')
            } else if (email === 'pm' || email === 'pm@demo.com') {
                devLogin('pm@demo.com', 'pm')
                toast.success('Welcome back, PM!')
                navigate('/approvals')
            } else if (email === 'boss' || email === 'boss@demo.com') {
                devLogin('boss@demo.com', 'boss')
                toast.success('Welcome back, Boss!')
                navigate('/approvals')
            } else if (email === 'user' || email === 'user@demo.com') {
                devLogin('user@demo.com', 'user')
                toast.success('Welcome back, User!')
                navigate('/my-assets')
            } else {
                toast.error('Invalid username')
            }
        } else {
            toast.error('Invalid password')
        }
        setIsLoading(false)
    }

    const handleBlinkLogin = () => {
        login()
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Smart Asset Manager</CardTitle>
                    <CardDescription className="text-center">
                        Choose your login method
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* Dev Login Form */}
                    <form onSubmit={handleDevLogin} className="space-y-4 border-b pb-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Username / Email</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    placeholder="admin"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="123"
                                    className="pl-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <Button className="w-full" type="submit" disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In (Dev)'}
                        </Button>
                        <div className="text-xs text-center text-muted-foreground">
                            <span className="font-semibold">Dev Accounts:</span> admin/123, pm/123, boss/123, user/123
                        </div>
                    </form>

                    {/* Blink Login Option */}
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            className="w-full relative"
                            onClick={handleBlinkLogin}
                            disabled={isLoading}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Sign in with Company SSO
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Use for production authentication (Azure Entra SSO)
                        </p>
                    </div>

                </CardContent>
            </Card>
        </div>
    )
}
