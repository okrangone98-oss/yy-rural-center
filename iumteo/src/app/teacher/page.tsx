import InstructorProfileForm from '@/components/instructor/InstructorProfileForm';

export default function TeacherPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dff5ea_0%,#f4f8f5_40%,#eef3ef_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <InstructorProfileForm />
      </div>
    </main>
  );
}
