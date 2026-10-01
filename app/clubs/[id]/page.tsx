import { ClubDetailPage } from "@/components/clubDetails"

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClubDetailPage clubId={id} />
}
