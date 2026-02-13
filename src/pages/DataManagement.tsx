import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useCategories, ICON_MAP } from '../hooks/useCategories'
import { useDepartments } from '../hooks/useDepartments'
import { useVendors } from '../hooks/useVendors'

export function DataManagement() {
  const { categories, addCategory, deleteCategory, iconOptions } = useCategories()
  const { departments, addDepartment, removeDepartment } = useDepartments()
  const { vendors, addVendor, removeVendor } = useVendors()

  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('printer')
  const [newDeptName, setNewDeptName] = useState('')
  const [newVendorName, setNewVendorName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')

  const handleAddCategory = async () => {
    const value = newCatName.trim()
    if (!value) return
    const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const exists = categories.some(c => c.value === slug)
    await addCategory(value, newCatIcon)
    if (!exists) {
      setNewCatName('')
      setSelectedCategoryId(slug)
    }
  }

  const handleAddDepartment = () => {
    const value = newDeptName.trim()
    if (!value) return
    const exists = departments.some(d => d.toLowerCase() === value.toLowerCase())
    addDepartment(value)
    if (!exists) {
      setNewDeptName('')
      setSelectedDepartment(value)
    }
  }

  const handleAddVendor = () => {
    const value = newVendorName.trim()
    if (!value) return
    const exists = vendors.some(v => v.toLowerCase() === value.toLowerCase())
    addVendor(value)
    if (!exists) {
      setNewVendorName('')
      setSelectedVendor(value)
    }
  }

  const selectedCategory = categories.find(c => c.id === selectedCategoryId) || null
  const SelectedCategoryIcon = selectedCategory ? (ICON_MAP[selectedCategory.icon] || ICON_MAP.default) : null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">Manage categories, departments, and vendors in a compact view.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Category Management</CardTitle>
          <CardDescription>Add or remove categories, departments, and vendors without long scrolling.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="categories" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Add New Category</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
                  <Input
                    placeholder="Category Name (e.g. Projector)"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleAddCategory()
                      }
                    }}
                    className="bg-background"
                  />
                  <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map(icon => (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2 capitalize">
                            {/* @ts-ignore */}
                            {React.createElement(ICON_MAP[icon], { className: 'w-4 h-4' })}
                            {icon}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={() => void handleAddCategory()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Manage Existing Categories</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={`Select category (${categories.length})`} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.label} ({cat.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={!selectedCategory}
                    onClick={() => {
                      if (!selectedCategory) return
                      deleteCategory(selectedCategory.id)
                      setSelectedCategoryId('')
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
                {selectedCategory && (
                  <div className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded-md text-primary">
                      {SelectedCategoryIcon && <SelectedCategoryIcon className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selectedCategory.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedCategory.value}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-56 overflow-auto space-y-2 pr-1">
                {categories.map(cat => {
                  const Icon = ICON_MAP[cat.icon] || ICON_MAP.default
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{cat.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cat.value}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="departments" className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Add Department</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <Input
                    placeholder="Department Name (e.g. Operations)"
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddDepartment()
                      }
                    }}
                    className="bg-background"
                  />
                  <Button type="button" onClick={handleAddDepartment}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Manage Existing Departments</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={`Select department (${departments.length})`} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dep => (
                        <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={!selectedDepartment}
                    onClick={() => {
                      if (!selectedDepartment) return
                      removeDepartment(selectedDepartment)
                      setSelectedDepartment('')
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="max-h-56 overflow-auto space-y-2 pr-1">
                {departments.map(dep => (
                  <div key={dep} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg">
                    <p className="font-medium text-sm">{dep}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="vendors" className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Add Vendor</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <Input
                    placeholder="Vendor Name (e.g. Lenovo)"
                    value={newVendorName}
                    onChange={e => setNewVendorName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddVendor()
                      }
                    }}
                    className="bg-background"
                  />
                  <Button type="button" onClick={handleAddVendor}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl space-y-4">
                <h4 className="text-sm font-medium">Manage Existing Vendors</h4>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={`Select vendor (${vendors.length})`} />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(vendor => (
                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={!selectedVendor}
                    onClick={() => {
                      if (!selectedVendor) return
                      removeVendor(selectedVendor)
                      setSelectedVendor('')
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="max-h-56 overflow-auto space-y-2 pr-1">
                {vendors.map(vendor => (
                  <div key={vendor} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg">
                    <p className="font-medium text-sm">{vendor}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
