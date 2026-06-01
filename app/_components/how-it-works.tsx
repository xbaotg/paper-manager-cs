import { PenLine, CheckCircle2, Globe } from "lucide-react";

const steps = [
  {
    num: 1,
    icon: PenLine,
    title: "Nhập thông tin",
    description:
      "Điền tên bài báo, năm công bố, hội nghị / tạp chí và danh sách tác giả.",
  },
  {
    num: 2,
    icon: CheckCircle2,
    title: "Xác nhận gửi",
    description:
      'Kiểm tra lại thông tin và nhấn "Gửi bài báo" để lưu vào hệ thống.',
  },
  {
    num: 3,
    icon: Globe,
    title: "Công bố trên web",
    description:
      "Bài báo tự động xuất hiện trong danh sách và thống kê của Khoa.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 bg-gradient-to-b from-secondary/30 to-card"
    >
      <div className="container mx-auto px-6 max-w-5xl text-center">
        <span className="eyebrow block mb-4">Hướng dẫn</span>
        <h2 className="text-3xl sm:text-4xl font-semibold font-heading mb-4">
          Quy trình 3 bước
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-14">
          Chỉ cần 3 bước đơn giản để đưa bài báo của bạn vào danh sách Khoa.
        </p>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-[44px] left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-0.5 bg-gradient-to-r from-primary/40 via-primary to-cta/60 z-0" />

          {steps.map((s) => (
            <div key={s.num} className="relative z-10 text-center px-4 group">
              <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-card border-[3px] border-primary flex items-center justify-center shadow-md group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200 cursor-default">
                <span className="text-xl font-semibold font-heading text-primary group-hover:text-primary-foreground transition-colors duration-200">
                  {s.num}
                </span>
              </div>
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center text-primary/60">
                <s.icon className="size-7" />
              </div>
              <h3 className="text-lg font-semibold font-heading mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
