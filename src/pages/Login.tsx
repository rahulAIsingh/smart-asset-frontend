import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card'
import { Lock, User, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { dataClient } from '../lib/dataClient'

export function Login() {
    const navigate = useNavigate()
    const { devLogin, login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const enableDevLogin = import.meta.env.DEV || String(import.meta.env.VITE_ENABLE_DEV_LOGIN || '').toLowerCase() === 'true'

    useEffect(() => {
        const authError = localStorage.getItem('sam_auth_last_error')
        if (authError) {
            toast.error(authError, { duration: 7000 })
            localStorage.removeItem('sam_auth_last_error')
        }
    }, [])

    const handleDevLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!enableDevLogin) {
            toast.error('Dev login is disabled. Use Company SSO.')
            return
        }
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

    const handleSsoLogin = () => {
        login()
    }

    return (
        <div className="relative min-h-[100dvh] w-full flex items-start sm:items-center justify-center px-3 py-10 sm:px-6 sm:py-10 overflow-x-hidden overflow-y-auto">
            <div className="absolute inset-0 bg-[#dff4f8]" />
            <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
            >
                <g stroke="#7fa5ad" strokeOpacity="0.26" strokeWidth="2" fill="none">
                    <path d="M140 210 L420 210 L420 300 L700 300 L700 190 L980 190 L980 340 L1270 340" />
                    <path d="M220 450 L480 450 L480 360 L840 360 L840 520 L1180 520" />
                    <path d="M120 640 L360 640 L360 760 L760 760 L760 580 L1220 580" />
                    <path d="M560 120 L560 250 L620 250" />
                    <path d="M900 260 L990 260 L990 170" />
                    <path d="M250 560 L250 470" />
                    <path d="M1060 700 L1060 610" />
                    <path strokeDasharray="6 8" d="M320 270 L320 520 L650 520" />
                    <path strokeDasharray="6 8" d="M900 420 L1120 420 L1120 700" />
                </g>
                <g fill="#7fa5ad" fillOpacity="0.24">
                    <rect x="470" y="278" width="70" height="40" rx="8" />
                    <rect x="720" y="170" width="72" height="40" rx="8" />
                    <rect x="860" y="500" width="68" height="40" rx="8" />
                    <rect x="250" y="618" width="68" height="40" rx="8" />
                    <rect x="1080" y="316" width="78" height="44" rx="8" />
                </g>
                <g fill="#7fa5ad" fillOpacity="0.2">
                    <circle cx="420" cy="210" r="8" />
                    <circle cx="700" cy="300" r="8" />
                    <circle cx="980" cy="190" r="8" />
                    <circle cx="840" cy="520" r="8" />
                    <circle cx="760" cy="760" r="8" />
                </g>
                {/* Icon-like details to better match the reference background */}
                <g stroke="#6f98a1" strokeOpacity="0.22" strokeWidth="2" fill="none">
                    {/* Servers */}
                    <g transform="translate(560 90)">
                        <rect x="0" y="0" width="120" height="68" rx="10" />
                        <line x1="16" y1="18" x2="104" y2="18" />
                        <line x1="16" y1="34" x2="104" y2="34" />
                        <line x1="16" y1="50" x2="78" y2="50" />
                        <circle cx="96" cy="50" r="3" />
                        <circle cx="106" cy="50" r="3" />
                    </g>
                    <g transform="translate(690 90)">
                        <rect x="0" y="0" width="120" height="68" rx="10" />
                        <line x1="16" y1="18" x2="104" y2="18" />
                        <line x1="16" y1="34" x2="104" y2="34" />
                        <line x1="16" y1="50" x2="78" y2="50" />
                        <circle cx="96" cy="50" r="3" />
                        <circle cx="106" cy="50" r="3" />
                    </g>

                    {/* Document / page */}
                    <g transform="translate(980 96)">
                        <rect x="0" y="0" width="66" height="86" rx="10" />
                        <path d="M46 0 L66 20 L46 20 Z" />
                        <line x1="14" y1="34" x2="52" y2="34" />
                        <line x1="14" y1="48" x2="52" y2="48" />
                        <line x1="14" y1="62" x2="40" y2="62" />
                    </g>

                    {/* Calendar */}
                    <g transform="translate(260 720)">
                        <rect x="0" y="0" width="86" height="74" rx="12" />
                        <line x1="0" y1="22" x2="86" y2="22" />
                        <line x1="20" y1="0" x2="20" y2="14" />
                        <line x1="66" y1="0" x2="66" y2="14" />
                        <circle cx="22" cy="40" r="3" />
                        <circle cx="40" cy="40" r="3" />
                        <circle cx="58" cy="40" r="3" />
                        <circle cx="22" cy="56" r="3" />
                        <circle cx="40" cy="56" r="3" />
                        <circle cx="58" cy="56" r="3" />
                    </g>

                    {/* Clipboard/check */}
                    <g transform="translate(680 760)">
                        <rect x="0" y="10" width="90" height="110" rx="14" />
                        <rect x="22" y="0" width="46" height="26" rx="10" />
                        <path d="M22 66 L40 84 L70 54" />
                        <line x1="18" y1="40" x2="72" y2="40" />
                    </g>

                    {/* Simple gear */}
                    <g transform="translate(1160 120)">
                        <circle cx="44" cy="44" r="22" />
                        <circle cx="44" cy="44" r="8" />
                        <path d="M44 8 L44 0" />
                        <path d="M44 88 L44 96" />
                        <path d="M8 44 L0 44" />
                        <path d="M88 44 L96 44" />
                        <path d="M18 18 L12 12" />
                        <path d="M70 70 L76 76" />
                        <path d="M18 70 L12 76" />
                        <path d="M70 18 L76 12" />
                    </g>

                    {/* Wrench */}
                    <g transform="translate(170 170) rotate(-18)">
                        <path d="M26 16 A16 16 0 0 0 6 36 L18 48 L32 34 L22 24 L28 18 Z" />
                        <path d="M18 48 L60 90" />
                        <circle cx="64" cy="94" r="6" />
                    </g>
                </g>

                {/* Barcodes */}
                <g fill="#6f98a1" fillOpacity="0.20">
                    <g transform="translate(190 260)">
                        <rect x="0" y="0" width="3" height="28" />
                        <rect x="6" y="0" width="2" height="28" />
                        <rect x="12" y="0" width="5" height="28" />
                        <rect x="22" y="0" width="2" height="28" />
                        <rect x="28" y="0" width="4" height="28" />
                        <rect x="38" y="0" width="2" height="28" />
                        <rect x="44" y="0" width="6" height="28" />
                        <rect x="54" y="0" width="2" height="28" />
                        <rect x="60" y="0" width="4" height="28" />
                    </g>
                    <g transform="translate(1090 260)">
                        <rect x="0" y="0" width="3" height="28" />
                        <rect x="6" y="0" width="2" height="28" />
                        <rect x="12" y="0" width="5" height="28" />
                        <rect x="22" y="0" width="2" height="28" />
                        <rect x="28" y="0" width="4" height="28" />
                        <rect x="38" y="0" width="2" height="28" />
                        <rect x="44" y="0" width="6" height="28" />
                        <rect x="54" y="0" width="2" height="28" />
                        <rect x="60" y="0" width="4" height="28" />
                    </g>
                    <g transform="translate(690 34)">
                        <rect x="0" y="0" width="3" height="24" />
                        <rect x="6" y="0" width="2" height="24" />
                        <rect x="12" y="0" width="5" height="24" />
                        <rect x="22" y="0" width="2" height="24" />
                        <rect x="28" y="0" width="4" height="24" />
                        <rect x="38" y="0" width="2" height="24" />
                        <rect x="44" y="0" width="6" height="24" />
                        <rect x="54" y="0" width="2" height="24" />
                        <rect x="60" y="0" width="4" height="24" />
                    </g>
                </g>
            </svg>
            <div className="fixed left-3 top-3 sm:left-6 sm:top-6 z-20 select-none w-[clamp(160px,24vw,320px)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.10)]">
                <svg
                    className="h-auto w-full"
                    viewBox="-20 -20 980 180"
                    aria-label="KAVITECH logo"
                    shapeRendering="geometricPrecision"
                    overflow="visible"
                >
                    <line x1="98" y1="84" x2="140" y2="44" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
                    <line x1="98" y1="84" x2="140" y2="124" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="148" cy="44" r="40" fill="#f3d628" />
                    <circle cx="86" cy="84" r="28" fill="#59c4d6" />
                    <circle cx="148" cy="124" r="22" fill="#2fa5df" />
                    <text x="215" y="104" fill="#111111" fontFamily="Arial Black, Arial, sans-serif" fontSize="84" fontWeight="900">KAVITECH</text>
                </svg>
            </div>
            <div className="absolute inset-0 bg-white/18" />
            <Card className="relative z-10 w-full max-w-md sm:max-w-xl bg-white shadow-2xl mt-20 sm:mt-0">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Asset Management</CardTitle>
                    <CardDescription className="text-center">
                        Choose your login method
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* Dev Login Form */}
                    {enableDevLogin ? (
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
                    ) : null}

                    {/* SSO Login Option */}
                    <div className={enableDevLogin ? "pt-2" : ""}>
                        <Button
                            variant="outline"
                            className="w-full relative"
                            onClick={handleSsoLogin}
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



