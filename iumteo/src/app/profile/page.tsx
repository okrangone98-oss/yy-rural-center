import MemberProfileForm from '@/components/member/MemberProfileForm';

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f1fb_0%,#f4f8f5_40%,#eef3ef_100%)] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <MemberProfileForm />
      </div>
    </main>
  );
}
