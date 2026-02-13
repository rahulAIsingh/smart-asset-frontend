export type AiInsight = {
  id: string
  message: string
  severity: 'low' | 'medium' | 'high'
  tag: string
}

export const demoInsights: AiInsight[] = [
  {
    id: 'ai-1',
    message: 'Dell Latitude 7420: 3 screen issues in 90 days. Consider replacement.',
    severity: 'high',
    tag: 'Replace'
  },
  {
    id: 'ai-2',
    message: 'KTPL-L12 ticket opened during warranty. Suggest warranty claim.',
    severity: 'medium',
    tag: 'Warranty'
  },
  {
    id: 'ai-3',
    message: 'Model Dell Latitude 3320 shows higher ticket volume this quarter.',
    severity: 'medium',
    tag: 'Model Risk'
  },
  {
    id: 'ai-4',
    message: 'Battery-related issues recurring on KTPL-L08 (2 in 60 days).',
    severity: 'low',
    tag: 'Recurring'
  },
  {
    id: 'ai-5',
    message: 'HP EliteBook 840: 2 motherboard repairs logged. Monitor closely.',
    severity: 'high',
    tag: 'Critical'
  },
  {
    id: 'ai-6',
    message: 'Printer KTPL-P03 has repeated paper‑jam incidents in the last month.',
    severity: 'medium',
    tag: 'Operational'
  },
  {
    id: 'ai-7',
    message: 'Scanner KTPL-B05 shows 3 connectivity faults. Recommend firmware update.',
    severity: 'medium',
    tag: 'Action'
  },
  {
    id: 'ai-8',
    message: 'Asset KTPL-M02 nearing warranty end in 21 days.',
    severity: 'low',
    tag: 'Warranty'
  },
  {
    id: 'ai-9',
    message: 'Model ThinkPad T14 had 5 tickets across departments this quarter.',
    severity: 'medium',
    tag: 'Model Risk'
  },
  {
    id: 'ai-10',
    message: 'Laptop KTPL-L21 reported overheating twice after RAM upgrade.',
    severity: 'low',
    tag: 'Recurring'
  }
]
