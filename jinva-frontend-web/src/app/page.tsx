import { redirect } from "next/navigation"

export default function Home() {
  redirect("/signup") // or "/dashboard", etc.
}