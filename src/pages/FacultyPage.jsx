import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNotification } from "../context/NotificationContext";
import { InstructorModal } from "../components/modals/InstructorModal";

export default function FacultyPage() {
  const { showNotification } = useNotification();

  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editInstructor, setEditInstructor] = useState(null);

  useEffect(() => {
    fetchInstructors();
  }, []);

  async function fetchInstructors() {
    const { data, error } = await supabase
      .from("instructors")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setInstructors(data);
    setLoading(false);
  }

  async function addInstructor(instructor) {
    const { data, error } = await supabase
      .from("instructors")
      .insert([instructor])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setInstructors([...instructors, data[0]]);
  }

  async function updateInstructor(id, instructor) {
    const { data, error } = await supabase
      .from("instructors")
      .update(instructor)
      .eq("id", id)
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setInstructors(
      instructors.map((i) => (i.id === id ? data[0] : i))
    );
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete instructor ${name}?`)) return;

    const { error } = await supabase
      .from("instructors")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setInstructors(instructors.filter((i) => i.id !== id));
    showNotification(`${name} removed.`);
  }

  if (loading) {
    return <div className="page-container">Loading instructors...</div>;
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Faculty Management</div>
          <div className="section-subtitle">Teaching load & availability tracking</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditInstructor(null);
            setShowModal(true);
          }}
        >
          + Add Instructor
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Department</th>
              <th>Availability</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-table">
                  No instructors yet. Click <strong>"Add Instructor"</strong> to add one.
                </td>
              </tr>
            ) : (
              instructors.map((inst) => (
                <tr key={inst.id}>
                  <td><strong>{inst.name}</strong></td>
                  <td>{inst.department}</td>
                  <td style={{ fontSize: 12 }}>{inst.availability}</td>
                  <td>
                    <span className={`pill pill-${inst.status === "Active" ? "green" : "red"}`}>
                      {inst.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditInstructor(inst);
                          setShowModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(inst.id, inst.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InstructorModal
          existing={editInstructor}
          onClose={() => setShowModal(false)}
          onSave={async (instructor) => {
            if (editInstructor) {
              await updateInstructor(editInstructor.id, instructor);
              showNotification(`${instructor.name} updated!`);
            } else {
              await addInstructor(instructor);
              showNotification("Instructor added successfully!");
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}