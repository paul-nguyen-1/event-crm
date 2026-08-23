import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import * as contactsApi from '@/api/contacts'
import { ContactDialog } from '@/components/contact-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ContactsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.listContacts,
  })

  const deleteMutation = useMutation({
    mutationFn: contactsApi.deleteContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="m-0">People</h3>
        <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Add person
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {contacts && contacts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <h2>Nothing tracked yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Start with the one date you&apos;re most afraid of missing.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add one person
          </Button>
        </div>
      )}

      {contacts && contacts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="grid size-[26px] flex-none place-items-center border border-border font-heading text-xs font-semibold text-primary">
                      {initials(contact.name)}
                    </span>
                    {contact.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.relationshipType || '—'}
                </TableCell>
                <TableCell className="max-w-72 truncate text-muted-foreground">
                  {contact.notes || '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Remove ${contact.name}?`)) {
                        deleteMutation.mutate(contact.id)
                      }
                    }}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(saved) => navigate(`/contacts/${saved.id}`)}
      />
    </div>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
