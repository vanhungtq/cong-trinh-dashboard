import type { Workspace, Project, Task, TaskStatus } from "./types";
import { localDate } from "./metrics";
export function makeDemo(now = new Date()): Workspace {
  const date = (offset: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    return localDate(d);
  };
  const people: Workspace["people"] = [
    {
      id: "hung",
      name: "Văn Hùng",
      email: "hung@example.com",
      role: "admin",
      discipline: "Điều hành",
      capacity: 40,
    },
    {
      id: "minh",
      name: "Nguyễn Quang Minh",
      email: "minh@example.com",
      role: "manager",
      discipline: "Chủ nhiệm dự án",
      capacity: 40,
    },
    {
      id: "lan",
      name: "Trần Ngọc Lan",
      email: "lan@example.com",
      role: "manager",
      discipline: "Kiến trúc",
      capacity: 40,
    },
    {
      id: "nam",
      name: "Lê Hoài Nam",
      email: "nam@example.com",
      role: "staff",
      discipline: "Kết cấu",
      capacity: 40,
    },
    {
      id: "linh",
      name: "Phạm Thùy Linh",
      email: "linh@example.com",
      role: "staff",
      discipline: "Dự toán",
      capacity: 40,
    },
    {
      id: "duc",
      name: "Hoàng Anh Đức",
      email: "duc@example.com",
      role: "staff",
      discipline: "Điện nước",
      capacity: 40,
    },
    {
      id: "ha",
      name: "Đỗ Thu Hà",
      email: "ha@example.com",
      role: "finance",
      discipline: "Kế toán",
      capacity: 40,
    },
  ];
  people.forEach((p) => {
    p.department =
      p.role === "admin"
        ? "Ban điều hành"
        : p.role === "finance"
          ? "Phòng Tài chính"
          : p.discipline.includes("Chủ nhiệm")
            ? "Phòng Dự án"
            : "Phòng Thiết kế";
    p.team =
      p.role === "finance"
        ? "Kế toán"
        : p.role === "admin" || p.discipline.includes("Chủ nhiệm")
          ? "Điều phối"
          : p.discipline.includes("Kết cấu")
            ? "Kết cấu"
            : p.discipline.toLowerCase().includes("điện")
              ? "MEP"
              : "Kiến trúc";
  });
  const projects: Project[] = [
    {
      id: "p1",
      code: "DA-026",
      name: "Trường Tiểu học Tân Trào",
      client: "Ban QLDA khu vực Sơn Dương",
      location: "Tuyên Quang",
      managerId: "minh",
      contract: 780000000,
      accepted: 390000000,
      start: date(-55),
      due: date(25),
      status: "active",
      phase: "Thiết kế bản vẽ thi công",
      color: "#547562",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
    {
      id: "p2",
      code: "DA-025",
      name: "Trung tâm Y tế Minh Xuân",
      client: "Ban QLDA công trình dân dụng",
      location: "Tuyên Quang",
      managerId: "lan",
      contract: 1250000000,
      accepted: 750000000,
      start: date(-90),
      due: date(12),
      status: "active",
      phase: "Thẩm tra & hoàn thiện",
      color: "#8c735c",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
    {
      id: "p3",
      code: "DA-024",
      name: "Đường liên xã Hồng Thái",
      client: "Ban QLDA khu vực Na Hang",
      location: "Tuyên Quang",
      managerId: "minh",
      contract: 420000000,
      accepted: 84000000,
      start: date(-20),
      due: date(70),
      status: "active",
      phase: "Khảo sát & phương án",
      color: "#6c7b8f",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
    {
      id: "p4",
      code: "DA-023",
      name: "Trụ sở hành chính Phú Lương",
      client: "Ban QLDA khu vực Phú Lương",
      location: "Thái Nguyên",
      managerId: "lan",
      contract: 960000000,
      accepted: 480000000,
      start: date(-75),
      due: date(5),
      status: "active",
      phase: "Lập dự toán",
      color: "#97786c",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
    {
      id: "p5",
      code: "DA-022",
      name: "Nhà văn hóa Kim Phú",
      client: "UBND phường Kim Phú",
      location: "Tuyên Quang",
      managerId: "minh",
      contract: 650000000,
      accepted: 0,
      start: date(-15),
      due: date(65),
      status: "paused",
      phase: "Chờ bổ sung đầu vào",
      color: "#8a8d62",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
    {
      id: "p6",
      code: "DA-021",
      name: "Cải tạo Trường THCS An Tường",
      client: "Ban QLDA công trình dân dụng",
      location: "Tuyên Quang",
      managerId: "lan",
      contract: 380000000,
      accepted: 380000000,
      start: date(-120),
      due: date(-15),
      status: "completed",
      phase: "Đã nghiệm thu",
      color: "#658980",
      boardId: "",
      boardUrl: "",
      driveFolderId: "",
    },
  ];
  const titles = [
    "Khảo sát và xác nhận hiện trạng",
    "Hoàn thiện bản vẽ kiến trúc",
    "Tính toán và thiết kế kết cấu",
    "Triển khai hệ thống điện nước",
    "Bóc khối lượng và lập dự toán",
    "Kiểm tra, phát hành hồ sơ",
  ];
  const states: TaskStatus[][] = [
    ["done", "done", "doing", "review", "doing", "todo"],
    ["done", "done", "done", "review", "blocked", "todo"],
    ["done", "doing", "todo", "todo", "todo", "todo"],
    ["done", "done", "done", "done", "doing", "blocked"],
    ["done", "blocked", "todo", "todo", "todo", "todo"],
    ["done", "done", "done", "done", "done", "done"],
  ];
  const weights = [15, 20, 20, 15, 20, 10];
  const owners = ["minh", "lan", "nam", "duc", "linh", "minh"];
  const tasks: Task[] = projects.flatMap((p, i) =>
    titles.map((title, j) => {
      const status = states[i][j];
      return {
        id: `t${i}-${j}`,
        projectId: p.id,
        title,
        assigneeId: owners[j],
        status,
        due: date(
          i === 1 && j === 4
            ? -3
            : i === 3 && j === 4
              ? -2
              : i === 5
                ? -20
                : 3 + j * 3,
        ),
        completedAt: status === "done" ? date(-25 + j) : "",
        weight: weights[j],
        progress:
          status === "done"
            ? 100
            : status === "review"
              ? 80
              : status === "doing"
                ? 40
                : status === "blocked"
                  ? 20
                  : 0,
        hours: [12, 24, 32, 20, 24, 8][j],
        reviewRounds: status === "done" ? j % 2 : status === "review" ? 1 : 0,
        blockReason:
          status === "blocked"
            ? i === 1
              ? "Chờ xác nhận chủng loại thiết bị từ chủ đầu tư"
              : i === 3
                ? "Chờ thống nhất khối lượng điều chỉnh"
                : "Thiếu số liệu khảo sát địa hình"
            : "",
        url: "",
      };
    }),
  );
  const receipts: Workspace["receipts"] = [
    {
      id: "r1",
      projectId: "p1",
      amount: 156000000,
      date: date(-95),
      reference: "PT-001",
      note: "Tạm ứng hợp đồng",
    },
    {
      id: "r2",
      projectId: "p2",
      amount: 250000000,
      date: date(-65),
      reference: "PT-002",
      note: "Tạm ứng hợp đồng",
    },
    {
      id: "r3",
      projectId: "p6",
      amount: 190000000,
      date: date(-40),
      reference: "PT-003",
      note: "Thanh toán đợt 1",
    },
    {
      id: "r4",
      projectId: "p4",
      amount: 192000000,
      date: date(-30),
      reference: "PT-004",
      note: "Tạm ứng hợp đồng",
    },
    {
      id: "r5",
      projectId: "p1",
      amount: 156000000,
      date: date(-18),
      reference: "PT-005",
      note: "Thanh toán đợt 1",
    },
    {
      id: "r6",
      projectId: "p2",
      amount: 250000000,
      date: date(-8),
      reference: "PT-006",
      note: "Thanh toán đợt 1",
    },
    {
      id: "r7",
      projectId: "p3",
      amount: 84000000,
      date: date(-3),
      reference: "PT-007",
      note: "Tạm ứng hợp đồng",
    },
    {
      id: "r8",
      projectId: "p6",
      amount: 190000000,
      date: date(-1),
      reference: "PT-008",
      note: "Thanh toán hoàn thành",
    },
  ];
  return {
    projects,
    tasks,
    people,
    receipts,
    terms: [
      {
        id: "term1",
        projectId: "p2",
        title: "Thanh toán giai đoạn thiết kế",
        amount: 250000000,
        received: 0,
        due: date(-5),
      },
      {
        id: "term2",
        projectId: "p1",
        title: "Thanh toán đợt 2",
        amount: 78000000,
        received: 0,
        due: date(7),
      },
      {
        id: "term3",
        projectId: "p4",
        title: "Thanh toán hồ sơ dự toán",
        amount: 288000000,
        received: 0,
        due: date(14),
      },
    ],
    documents: projects.flatMap((p) => [
      {
        id: `d-${p.id}-1`,
        projectId: p.id,
        name: `${p.code}_Hop-dong-tu-van.pdf`,
        category: "Hợp đồng",
        version: "V01",
        status: "Đã ký",
        url: "",
        updatedAt: date(-30),
      },
      {
        id: `d-${p.id}-2`,
        projectId: p.id,
        name: `${p.code}_Ban-ve-kien-truc.pdf`,
        category: "Thiết kế",
        version: "V02",
        status: p.status === "completed" ? "Phát hành" : "Đang kiểm tra",
        url: "",
        updatedAt: date(-2),
      },
    ]),
    settings: {
      companyName: "Công Trình",
      listMapping: {},
      lastSync: "",
      syncError: "",
    },
  };
}
