import { useState, useEffect } from 'react'
import { dataClient } from '../lib/dataClient'
import {
    Laptop,
    Smartphone,
    Monitor,
    Headphones,
    Usb,
    Printer,
    ScanBarcode,
    Package,
    Server,
    Camera,
    Keyboard,
    Mouse
} from 'lucide-react'
import { toast } from 'sonner'

export type Category = {
    id: string
    label: string
    value: string
    icon: string // Store icon name as string
}

export const ICON_MAP: Record<string, any> = {
    laptop: Laptop,
    smartphone: Smartphone,
    monitor: Monitor,
    headsets: Headphones,
    peripherals: Usb,
    printer: Printer,
    scanner: ScanBarcode,
    package: Package,
    server: Server,
    camera: Camera,
    keyboard: Keyboard,
    mouse: Mouse,
    default: Usb
}

const DEFAULT_CATEGORIES = [
    { label: 'Laptop', value: 'laptop', icon: 'laptop' },
    { label: 'Smartphone', value: 'smartphone', icon: 'smartphone' },
    { label: 'Monitor', value: 'monitor', icon: 'monitor' },
    { label: 'Headsets', value: 'headsets', icon: 'headsets' },
    { label: 'Peripherals', value: 'peripherals', icon: 'peripherals' },
    { label: 'Printer', value: 'printer', icon: 'printer' },
    { label: 'Barcode Scanner', value: 'scanner', icon: 'scanner' },
]

const STORAGE_KEY = 'sam_categories'
let categoriesCache: Category[] | null = null
let categoriesFetchPromise: Promise<Category[]> | null = null
let categoriesApiWarned = false

const withFallbackIds = (items: Array<Partial<Category>>) =>
    items
        .filter((item): item is Category => Boolean(item?.label && item?.value && item?.icon))
        .map(item => ({
            id: item.id || item.value!,
            label: item.label!,
            value: item.value!,
            icon: item.icon!
        }))

const getStoredCategories = (): Category[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return withFallbackIds(DEFAULT_CATEGORIES)
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed) || parsed.length === 0) return withFallbackIds(DEFAULT_CATEGORIES)
        return withFallbackIds(parsed)
    } catch {
        return withFallbackIds(DEFAULT_CATEGORIES)
    }
}

const setStoredCategories = (items: Category[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    categoriesCache = items
}

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>(() => getStoredCategories())
    const [loading, setLoading] = useState(true)
    const [dbUnavailable, setDbUnavailable] = useState(false)

    useEffect(() => {
        categoriesCache = categories
        fetchCategories()
    }, [])

    const fetchCategoriesFromApi = async () => {
        if (categoriesCache && categoriesCache.length > 0) return categoriesCache
        if (!categoriesFetchPromise) {
            categoriesFetchPromise = dataClient.db.categories.list()
                .then(data => withFallbackIds(data.length > 0 ? data : DEFAULT_CATEGORIES))
                .finally(() => {
                    categoriesFetchPromise = null
                })
        }
        return categoriesFetchPromise
    }

    const fetchCategories = async (isRetry = false) => {
        if (dbUnavailable) {
            setCategories(getStoredCategories())
            setLoading(false)
            return
        }

        try {
            const data = await fetchCategoriesFromApi()

            if (data.length === 0 && !isRetry) {
                // Seed initial categories if empty and haven't tried yet
                await seedCategories()
            } else {
                const next = data.length > 0 ? data : withFallbackIds(DEFAULT_CATEGORIES)
                setCategories(next)
                setStoredCategories(next)
            }
        } catch (error) {
            console.error('Error fetching categories:', error)
            const fallback = getStoredCategories()
            setCategories(fallback)
            setDbUnavailable(true)
            if (!categoriesApiWarned) {
                toast.error('Categories API unavailable, using local storage mode')
                categoriesApiWarned = true
            }
        } finally {
            setLoading(false)
        }
    }

    const seedCategories = async () => {
        try {
            console.log('🌱 Seeding initial categories...')
            const promises = DEFAULT_CATEGORIES.map(cat =>
                dataClient.db.categories.create(cat).catch(e => console.warn(`Failed to seed ${cat.value}:`, e))
            )
            await Promise.all(promises)
            fetchCategories(true) // Reload from DB with retry flag
        } catch (error) {
            console.error('Error seeding categories:', error)
            const fallback = getStoredCategories()
            setCategories(fallback)
            setLoading(false)
        }
    }

    const addCategory = async (label: string, iconName: string) => {
        try {
            const cleanLabel = label.trim()
            if (!cleanLabel) {
                toast.error('Please enter category name')
                return
            }
            const value = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')

            // Check for duplicate
            if (categories.some(c => c.value === value)) {
                toast.error('Category already exists')
                return
            }

            if (!dbUnavailable) {
                await dataClient.db.categories.create({
                    label: cleanLabel,
                    value,
                    icon: iconName
                })
                categoriesCache = null
                toast.success('Category added')
                fetchCategories()
                return
            }

            throw new Error('DB unavailable')
        } catch (error) {
            const cleanLabel = label.trim()
            const value = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')
            const nextCategory: Category = {
                id: value,
                label: cleanLabel,
                value,
                icon: iconName
            }
            const next = [...categories, nextCategory]
            setCategories(next)
            setStoredCategories(next)
            setDbUnavailable(true)
            toast.success('Category added locally')
        }
    }

    const deleteCategory = async (id: string) => {
        const next = categories.filter(c => c.id !== id)
        setCategories(next)
        setStoredCategories(next)
        try {
            if (!dbUnavailable) {
                await dataClient.db.categories.delete(id)
                categoriesCache = null
                toast.success('Category deleted')
                fetchCategories()
                return
            }

            throw new Error('DB unavailable')
        } catch (error) {
            setDbUnavailable(true)
            toast.success('Category deleted locally')
        }
    }

    return {
        categories,
        loading,
        addCategory,
        deleteCategory,
        iconOptions: Object.keys(ICON_MAP).filter(k => k !== 'default')
    }
}

