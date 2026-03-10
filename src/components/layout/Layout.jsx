import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Notification from "../common/Notification";
import styles from "./Layout.module.css";

export default function Layout() {
  return (
    <>
      <Header />
      <div className={styles.layout}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <Notification />
    </>
  );
}
