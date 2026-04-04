import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Profile } from '../../types'

interface StudentRowProps {
  student: Profile
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function StudentRow({ student, onApprove, onReject }: StudentRowProps) {
  const colors = getAvatarColors(student.full_name)
  const initials = getInitials(student.full_name)
  const isPending = student.status === 'pending'
  const isRejected = student.status === 'rejected'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px', background: '#fff',
      border: `0.5px solid ${isPending ? '#EF9F27' : 'rgba(0,0,0,0.12)'}`,
      borderRadius: '12px', marginBottom: '8px',
    }}>
      <Avatar initials={initials} bg={colors.bg} color={colors.color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>{student.email}</div>
      </div>
      <Badge
        label={isPending ? 'Pending' : isRejected ? 'Rejected' : 'Enrolled'}
        color={isPending ? 'amber' : isRejected ? 'red' : 'green'}
      />
      {isPending && onApprove && onReject && (
        <>
          <Button variant="primary" onClick={() => onApprove(student.id)}>Approve</Button>
          <Button variant="danger" onClick={() => onReject(student.id)}>Reject</Button>
        </>
      )}
    </div>
  )
}
