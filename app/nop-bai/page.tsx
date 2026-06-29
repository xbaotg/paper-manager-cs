"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "../_components/navbar";
import { Footer } from "../_components/footer";
import { StudentSubmissionForm } from "../_components/student-submission-form";
import { submitStudentPaperServer } from "../actions/submissions";

export default function SubmitPaperPage() {
  const router = useRouter();
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold font-heading mb-3">Sinh viên nộp bài báo</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Gửi thông tin bài báo của bạn để Khoa ghi nhận. Bài sẽ hiển thị công khai sau khi
              quản trị viên duyệt. Bạn <strong>không cần đăng nhập</strong> — sau khi gửi, hãy lưu
              lại đường link để chỉnh sửa bài về sau.
            </p>
          </div>
          <StudentSubmissionForm
            mode="create"
            onSubmit={async (input) => {
              const { token } = await submitStudentPaperServer(input);
              router.push(`/nop-bai/${token}`);
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
