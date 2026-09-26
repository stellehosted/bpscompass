// Shared "Email All" action for the club page and the club cards: opens the
// user's mail app with every member on the "To" line, except the sender.
export function openEmailAll(memberEmails: string[], clubName: string, senderEmail?: string | null) {
  const emails = [...new Set(memberEmails)].filter((email) => email && email !== senderEmail)
  if (emails.length === 0) {
    alert("This club has no other members to email yet.")
    return
  }
  window.location.href = `mailto:${emails.join(",")}?subject=${encodeURIComponent(clubName)}`
}
