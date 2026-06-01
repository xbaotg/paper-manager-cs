import { FilePlus2, BarChart3, LayoutGrid } from "lucide-react";

const features = [
  {
    icon: FilePlus2,
    title: "Nhập liệu dễ dàng",
    description:
      "Form nhập bài báo trực quan, nhanh chóng. Chỉ cần điền thông tin cơ bản: tên bài báo, năm, hội nghị/tạp chí và tác giả.",
    // Webflow chromatic category fills — surface colour, not buttons.
    surface: "bg-accent-purple text-white",
    iconBg: "bg-white/15",
  },
  {
    icon: BarChart3,
    title: "Thống kê & Báo cáo",
    description:
      "Biểu đồ trực quan theo năm, hội nghị. Tự động tổng hợp số liệu để phục vụ báo cáo và đánh giá hoạt động nghiên cứu.",
    surface: "bg-accent-blue text-white",
    iconBg: "bg-white/15",
  },
  {
    icon: LayoutGrid,
    title: "Danh sách công bố",
    description:
      "Bảng danh sách bài báo chuyên nghiệp với tìm kiếm, sắp xếp và phân trang. Sẵn sàng để tích hợp vào website Khoa.",
    // Green is the lighter accent — uses ink text for legibility (per DESIGN.md).
    surface: "bg-accent-green text-[#080808]",
    iconBg: "bg-black/10",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-background border-b border-border">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-14">
          <span className="eyebrow block mb-4">Tính năng</span>
          <h2 className="text-3xl sm:text-4xl font-semibold font-heading tracking-tight mb-4">
            Tại sao chọn Paper Manager?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Giải pháp toàn diện cho việc quản lý và thống kê công bố khoa học của Khoa.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className={`group rounded-md p-8 transition-transform duration-300 hover:-translate-y-1 ${f.surface}`}
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-md mb-6 ${f.iconBg}`}>
                <f.icon className="size-6" />
              </div>
              <h3 className="text-2xl font-semibold font-heading tracking-tight mb-3">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed opacity-90">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
