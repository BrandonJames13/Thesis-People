import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNotification } from "../context/NotificationContext";
import { CourseModal } from "../components/modals/courseModal";

export default function CoursesPage() {
  const { showNotification } = useNotification();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("code");

    if (error) {
      console.error(error);
      return;
    }

    setCourses(data);
    setLoading(false);
  }

  async function addCourse(course) {
    const { data, error } = await supabase
      .from("courses")
      .insert([course])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setCourses([...courses, data[0]]);
  }

  async function updateCourse(id, course) {
    const { data, error } = await supabase
      .from("courses")
      .update(course)
      .eq("id", id)
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setCourses(
      courses.map((c) =>
        c.id === id ? data[0] : c
      )
    );
  }

 async function handleDelete(id) {
    if (!window.confirm(`Delete course?`)) return;

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setCourses(courses.filter((c) => c.id !== id));
    showNotification(`Course deleted`);
}

  console.log("Courses:", courses);

  if (loading) {
    return <div className="page-container">Loading courses...</div>;
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Course Catalog</div>
          <div className="section-subtitle">AY 2025–2026</div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setEditCourse(null);
            setShowModal(true);
          }}
        >
          + Add Course
        </button>
      </div>

      <div className="card">
        <table className="course-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Section</th>
              <th>Title</th>
              <th>Program</th>
              <th>Year</th>
              <th>Enrolled</th>
              <th>Room Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {courses.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-table">
                  There are no courses yet. Click <strong>"Add Course"</strong> to add one.
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={`${c.code}-${c.section}`}>
                  <td>{c.code}</td>
                  <td>{c.section}</td>
                  <td>{c.title}</td>
                  <td>{c.program}</td>
                  <td>{c.year}</td>
                  <td>{c.enrolled}</td>
                  <td>{c.room_type}</td>

                  <td>
                    <span
                      className={`pill ${
                        c.status === "Assigned" ? "pill-green" : "pill-orange"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>

                  <td className="actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditCourse(c);
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CourseModal
          courses={courses}
          existing={editCourse}
          onClose={() => setShowModal(false)}
          onSave={async (course) => {
            if (editCourse) {
              await updateCourse(editCourse.id, course);
              showNotification("Course updated");
            } else {
              await addCourse(course);
              showNotification("Course added");
            }

            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}