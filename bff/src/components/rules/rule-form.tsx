import { RuleEditor } from './rule-editor'

interface RuleFormProps {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function RuleForm({ initialData, onSubmit, onCancel, isLoading }: RuleFormProps) {
  return (
    <RuleEditor
      rule={initialData}
      onSave={onSubmit}
      onCancel={onCancel}
      isLoading={isLoading}
      mode={initialData ? 'edit' : 'create'}
    />
  )
}