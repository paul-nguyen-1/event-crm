import { api } from '@/lib/api'
import type { Contact, ContactInput } from '@/schemas/contact'

export function listContacts() {
  return api.get<Contact[]>('/contacts')
}

export function getContact(id: string) {
  return api.get<Contact>(`/contacts/${id}`)
}

export function createContact(input: ContactInput) {
  return api.post<Contact>('/contacts', input)
}

export function updateContact(id: string, input: Partial<ContactInput>) {
  return api.patch<Contact>(`/contacts/${id}`, input)
}

export function deleteContact(id: string) {
  return api.delete<void>(`/contacts/${id}`)
}
