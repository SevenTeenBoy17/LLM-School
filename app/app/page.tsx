import { redirect } from "next/navigation";

/**
 * 根路径 → /portal（登录前的公开门户）。
 *
 * 原先是 `redirect("/login")`，即直接把人扔进登录表单。改成先落到门户页，
 * 是因为这一层本来就缺失：学校里第一次听说这个平台的人（新教师、家长）
 * 没有任何地方能了解「这是什么、谁能用、数据放在哪、要不要钱」，
 * 而一个只有账号密码框的页面回答不了这些。
 *
 * /portal 顶部与结尾都有「进入平台」直达 /login，已有账号的人多一次点击。
 * 若认为这次点击不值得，把下面一行改回 "/login" 即可——门户页仍可直接访问，
 * 两者不是互斥的。
 */
export default function Home() {
  redirect("/portal");
}
