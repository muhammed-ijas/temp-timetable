import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  TEACHERS,
  VP_PASSWORD,
  ML_LIMIT,
  CL_LIMIT,
  getSchoolYear,
  getSchoolYearLabel,
  countLeaveDays,
  fetchHolidayDates,
  schoolYearStart,
  schoolYearEnd,
} from "../lib/supabase";
import TeacherHistoryPanel from "../components/TeacherHistoryPanel";
import VPHeader from '../components/VPHeader'

const today = () => new Date().toISOString().split("T")[0];

function Badge({ vpStatus }) {
  if (vpStatus === "approved")
    return (
      <span
        style={{
          background: "#ECFDF5",
          color: "#065F46",
          border: "1px solid #6EE7B7",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        VP Approved
      </span>
    );
  if (vpStatus === "rejected")
    return (
      <span
        style={{
          background: "#FEF2F2",
          color: "#991B1B",
          border: "1px solid #FECACA",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        VP Rejected
      </span>
    );
  return (
    <span
      style={{
        background: "#F5F3FF",
        color: "#5B21B6",
        border: "1px solid #DDD6FE",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 600,
      }}
    >
      Awaiting VP
    </span>
  );
}

function openWhatsApp(
  phone,
  teacherName,
  leaveType,
  fromDate,
  toDate,
  days,
  action,
) {
  const msg = `Hi ${teacherName},\n\nYour ${leaveType === "ML" ? "Medical Leave" : leaveType === "SL" ? "Special Leave" : "Casual Leave"} request from ${fromDate} to ${toDate} (${days} day${days > 1 ? "s" : ""}) has been *${action === "approved" ? "Approved by VP ✓" : "Rejected by VP ✗"}*.\n\n— PGS Management`;
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
}

export default function VP() {
  const navigate = useNavigate();
  const currentSchoolYear = getSchoolYear();
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear);

  const [tab, setTab] = useState("requests");
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedHistoryTeacher, setSelectedHistoryTeacher] = useState(null);

  // Late mark state
  const [lateTeacher, setLateTeacher] = useState("");
  const [lateDate, setLateDate] = useState(today());
  const [lateMarksAll, setLateMarksAll] = useState([]);
  const [markingLate, setMarkingLate] = useState(false);

  // Holiday state
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Special Leave state
  const [slTeacher, setSlTeacher] = useState("");
  const [slFrom, setSlFrom] = useState(today());
  const [slTo, setSlTo] = useState(today());
  const [slReason, setSlReason] = useState("");
  const [grantingSl, setGrantingSl] = useState(false);
  const [slSuccess, setSlSuccess] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pgs_vp") !== VP_PASSWORD) {
      navigate("/");
      return;
    }
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: reqs }, { data: bals }, { data: hols }, { data: lm }] =
      await Promise.all([
        supabase
          .from("leave_requests")
          .select("*")
          .eq("school_year", currentSchoolYear)
          .order("created_at", { ascending: false }),
        supabase
          .from("leave_balances")
          .select("*")
          .eq("school_year", currentSchoolYear),
        supabase
          .from("holidays")
          .select("*")
          .eq("school_year", currentSchoolYear)
          .order("date", { ascending: true }),
        supabase
          .from("late_marks")
          .select("*")
          .eq("school_year", currentSchoolYear)
          .order("date", { ascending: false }),
      ]);
    setRequests(reqs || []);
    setHolidays(hols || []);
    setLateMarksAll(lm || []);
    const balMap = {};
    (bals || []).forEach((b) => {
      balMap[b.teacher_name] = b;
    });
    setBalances(
      TEACHERS.map(
        (t) =>
          balMap[t.name] || {
            teacher_name: t.name,
            ml_used: 0,
            cl_used: 0,
            ml_limit: ML_LIMIT,
            cl_limit: CL_LIMIT,
            school_year: currentSchoolYear,
            id: null,
          },
      ),
    );
    setLoading(false);
  }

  async function handleVPAction(req, action) {
    await supabase
      .from("leave_requests")
      .update({ vp_status: action, vp_reviewed_at: new Date().toISOString() })
      .eq("id", req.id);
    setRequests((p) =>
      p.map((r) => (r.id === req.id ? { ...r, vp_status: action } : r)),
    );
    await fetchAll();
  }

  // ── Late mark ──
 async function markLate() {
  if (!lateTeacher || !lateDate) return alert('Select teacher and date.')
  
  const exists = lateMarksAll.find(l => l.teacher_name === lateTeacher && l.date === lateDate && !l.cancelled)
  if (exists) return alert('This teacher already has a late mark on this date.')
  
  setMarkingLate(true)
  
  const { data: inserted, error } = await supabase.from('late_marks').insert({
    teacher_name: lateTeacher, date: lateDate, school_year: currentSchoolYear,
  }).select().single()
  
  if (error || !inserted) { setMarkingLate(false); return alert('Failed to mark late.') }

  // Only check lates from the same month
  const lateMonth = lateDate.slice(0, 7) // e.g. '2026-05'

  const { data: activeLates } = await supabase.from('late_marks').select('*')
    .eq('teacher_name', lateTeacher)
    .eq('school_year', currentSchoolYear)
    .eq('converted', false)
    .eq('cancelled', false)
    .gte('date', `${lateMonth}-01`)
    .lte('date', `${lateMonth}-31`)

  let clTriggered = false

  if (activeLates && activeLates.length % 2 === 0 && activeLates.length >= 2) {
    const toConvert = activeLates.slice(-2)

    const { data: clReq } = await supabase.from('leave_requests').insert({
      teacher_name: lateTeacher,
      leave_type: 'CL',
      from_date: lateDate,
      to_date: lateDate,
      days_count: 1,
      reason: `Auto: 2 late marks in ${lateMonth} → 1 CL deduction`,
      status: 'pending',
      exceeded: false,
      lwp_days: 0,
      vp_status: 'approved',
      is_auto_generated: true,
      school_year: currentSchoolYear,
    }).select().single()

    await supabase.from('late_marks')
      .update({ converted: true, conversion_request_id: clReq?.id })
      .in('id', toConvert.map(l => l.id))

    clTriggered = true
  }

  setMarkingLate(false)
  setLateTeacher('')
  setLateDate(today())
  await fetchAll()
  alert(`Late mark added for ${lateTeacher}${clTriggered ? '\n\n⚠ 2 lates this month — 1 CL deduction request sent to HR.' : ''}`)
}

  async function cancelLate(lm) {
    if (
      !window.confirm(`Cancel late mark for ${lm.teacher_name} on ${lm.date}?`)
    )
      return;
    await supabase
      .from("late_marks")
      .update({ cancelled: true })
      .eq("id", lm.id);
    // If it was converted, also cancel the CL request
    if (lm.converted && lm.conversion_request_id) {
      await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", lm.conversion_request_id);
      // Also unmark the paired late
      await supabase
        .from("late_marks")
        .update({ converted: false, conversion_request_id: null })
        .eq("conversion_request_id", lm.conversion_request_id);
    }
    await fetchAll();
  }

  // ── Holiday ──
  async function addHoliday() {
    if (!holidayDate || !holidayName.trim())
      return alert("Enter date and holiday name.");
    setAddingHoliday(true);
    await supabase
      .from("holidays")
      .upsert(
        {
          date: holidayDate,
          name: holidayName.trim(),
          school_year: currentSchoolYear,
          created_by: "vp",
        },
        { onConflict: "date,school_year" },
      );
    setHolidayDate("");
    setHolidayName("");
    setAddingHoliday(false);
    await fetchAll();
  }

  async function deleteHoliday(id) {
    if (!window.confirm("Remove this holiday?")) return;
    await supabase.from("holidays").delete().eq("id", id);
    await fetchAll();
  }

  // ── Special Leave ──
  async function grantSL() {
    if (!slTeacher || !slReason.trim())
      return alert("Select teacher and enter reason.");
    setGrantingSl(true);
    const holidayDates = await fetchHolidayDates(currentSchoolYear);
    const days = countLeaveDays(slFrom, slTo, holidayDates);

    await supabase.from("special_leaves").insert({
      teacher_name: slTeacher,
      from_date: slFrom,
      to_date: slTo,
      days_count: days,
      reason: slReason,
      granted_by: "vp",
      school_year: currentSchoolYear,
    });

    // Update sl_granted in balance
    const bal = balances.find((b) => b.teacher_name === slTeacher);
    if (bal?.id) {
      await supabase
        .from("leave_balances")
        .update({ sl_granted: (bal.sl_granted || 0) + days })
        .eq("id", bal.id);
    } else {
      await supabase
        .from("leave_balances")
        .insert({
          teacher_name: slTeacher,
          ml_used: 0,
          cl_used: 0,
          sl_granted: days,
          ml_limit: ML_LIMIT,
          cl_limit: CL_LIMIT,
          school_year: currentSchoolYear,
          year: currentSchoolYear,
        });
    }

    // WhatsApp teacher
    const phone = TEACHERS.find((t) => t.name === slTeacher)?.phone;
    if (phone) {
      const msg = `Hi ${slTeacher},\n\nYou have been granted *${days} day${days > 1 ? "s" : ""} Special Leave* from ${slFrom} to ${slTo}.\n\nReason: ${slReason}\n\n— PGS Management`;
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }

    setSlTeacher("");
    setSlReason("");
    setSlFrom(today());
    setSlTo(today());
    setGrantingSl(false);
    setSlSuccess(true);
    setTimeout(() => setSlSuccess(false), 4000);
    await fetchAll();
  }

  function getPhone(name) {
    return TEACHERS.find((t) => t.name === name)?.phone || "";
  }
  const pendingCount = requests.filter(
    (r) => r.vp_status === "pending" && r.status === "pending",
  ).length;
  const filtered =
    filter === "pending"
      ? requests.filter(
          (r) => r.vp_status === "pending" && r.status === "pending",
        )
      : filter === "approved"
        ? requests.filter((r) => r.vp_status === "approved")
        : filter === "rejected"
          ? requests.filter((r) => r.vp_status === "rejected")
          : requests;

  const slDays = countLeaveDays(
    slFrom,
    slTo,
    holidays.map((h) => h.date),
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F3FF",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #5B21B6; border-color: #5B21B6 !important; }
        @media (max-width: 640px) { .header-wrap { padding: 10px 14px !important; } .page-wrap { padding: 10px !important; } .teacher-history-grid { grid-template-columns: 1fr !important; } }
      `}</style>

     <VPHeader
  title="VP Dashboard"
  rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>AY {schoolYearLabel}</span>}
/>

      <div
        className="page-wrap"
        style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px" }}
      >
        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            {
              label: "Awaiting Review",
              val: requests.filter(
                (r) => r.vp_status === "pending" && r.status === "pending",
              ).length,
              color: "#5B21B6",
              bg: "#F5F3FF",
            },
            {
              label: "VP Approved",
              val: requests.filter((r) => r.vp_status === "approved").length,
              color: "#065F46",
              bg: "#ECFDF5",
            },
            {
              label: "VP Rejected",
              val: requests.filter((r) => r.vp_status === "rejected").length,
              color: "#991B1B",
              bg: "#FEF2F2",
            },
            {
              label: "Holidays Added",
              val: holidays.length,
              color: "#92400E",
              bg: "#FEF3C7",
            },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: c.bg,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: c.color,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  opacity: 0.75,
                  marginBottom: 4,
                }}
              >
                {c.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>
                {c.val}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 14,
            background: "#DDD6FE",
            borderRadius: 7,
            padding: 3,
            width: "fit-content",
            flexWrap: "wrap",
          }}
        >
          {[
            ["requests", "Leave Requests"],
            ["lates", "Late Marks"],
            ["holidays", "Holidays"],
            ["special", "Special Leave"],
            ["teachers", "Teacher History"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "6px 14px",
                borderRadius: 5,
                border: "none",
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#5B21B6" : "#6B7280",
                fontWeight: tab === key ? 600 : 500,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
              {key === "requests" && pendingCount > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 8,
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={fetchAll}
            style={{
              padding: "6px 10px",
              borderRadius: 5,
              border: "none",
              background: "transparent",
              color: "#6B7280",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ↻
          </button>
        </div>

        {/* ── REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              {[
                ["pending", "Awaiting Review"],
                ["approved", "Approved"],
                ["rejected", "Rejected"],
                ["all", "All"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${filter === key ? "#5B21B6" : "#D1D5DB"}`,
                    background: filter === key ? "#5B21B6" : "#fff",
                    color: filter === key ? "#fff" : "#374151",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <div
                style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}
              >
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}
              >
                No requests found.
              </div>
            ) : (
              filtered.map((req) => {
                const phone = getPhone(req.teacher_name);
                const alreadyActioned = req.vp_status !== "pending";
                return (
                  <div
                    key={req.id}
                    style={{
                      background: "#fff",
                      border: `1px solid ${req.vp_status === "pending" ? "#DDD6FE" : "#E5E7EB"}`,
                      borderRadius: 8,
                      padding: "12px 14px",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {req.teacher_name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              background: "#F3F4F6",
                              color: "#374151",
                              padding: "2px 7px",
                              borderRadius: 3,
                              fontWeight: 600,
                            }}
                          >
                            {req.leave_type === "ML"
                              ? "Medical"
                              : req.leave_type === "SL"
                                ? "Special"
                                : req.leave_type === "LATE"
                                  ? "Late→CL"
                                  : "Casual"}
                          </span>
                          <Badge vpStatus={req.vp_status} />
                          {req.is_auto_generated && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#FEF3C7",
                                color: "#92400E",
                                padding: "2px 6px",
                                borderRadius: 3,
                                fontWeight: 600,
                              }}
                            >
                              Auto
                            </span>
                          )}
                          {req.lwp_days > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#FEF2F2",
                                color: "#991B1B",
                                padding: "2px 6px",
                                borderRadius: 3,
                                fontWeight: 600,
                              }}
                            >
                              LWP: {req.lwp_days}d
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6B7280",
                            marginBottom: 2,
                          }}
                        >
                          {req.from_date} to {req.to_date}
                          <span
                            style={{
                              marginLeft: 8,
                              background: "#F3F4F6",
                              color: "#374151",
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 3,
                            }}
                          >
                            {req.days_count}d
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9CA3AF",
                            marginBottom: 4,
                          }}
                        >
                          {req.reason}
                        </div>
                        {req.document_url ? (
                          <a
                            href={req.document_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: "#1D4ED8",
                              textDecoration: "underline",
                            }}
                          >
                            📎 View Document
                          </a>
                        ) : (
                          req.leave_type === "ML" && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#92400E",
                                background: "#FEF3C7",
                                padding: "2px 6px",
                                borderRadius: 3,
                              }}
                            >
                              No document yet
                            </span>
                          )
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "flex-end",
                          flexShrink: 0,
                        }}
                      >
                        {!alreadyActioned && !req.is_auto_generated && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleVPAction(req, "approved")}
                              style={{
                                background: "#ECFDF5",
                                color: "#065F46",
                                border: "1px solid #A7F3D0",
                                padding: "6px 12px",
                                borderRadius: 5,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleVPAction(req, "rejected")}
                              style={{
                                background: "#FEF2F2",
                                color: "#991B1B",
                                border: "1px solid #FECACA",
                                padding: "6px 12px",
                                borderRadius: 5,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                        {req.is_auto_generated &&
                          req.vp_status === "approved" && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#6B7280",
                                fontStyle: "italic",
                              }}
                            >
                              Sent to HR for approval
                            </span>
                          )}
                        {alreadyActioned && phone && (
                          <button
                            onClick={() =>
                              openWhatsApp(
                                phone,
                                req.teacher_name,
                                req.leave_type,
                                req.from_date,
                                req.to_date,
                                req.days_count,
                                req.vp_status,
                              )
                            }
                            style={{
                              background: "#25D366",
                              color: "#fff",
                              border: "none",
                              padding: "6px 12px",
                              borderRadius: 5,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            📱 WhatsApp
                          </button>
                        )}
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>
                          {new Date(req.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── LATE MARKS TAB ── */}
        {tab === "lates" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 12,
            }}
          >
            {/* Add late mark form */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400E",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                🕐 Mark Late
              </div>

              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Teacher
                </label>
                <select
                  value={lateTeacher}
                  onChange={(e) => setLateTeacher(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Select teacher —</option>
                  {TEACHERS.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={lateDate}
                  onChange={(e) => setLateDate(e.target.value)}
                  max={today()}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    color: "#111827",
                  }}
                />
              </div>

              {/* Show current lates for selected teacher */}
              {lateTeacher &&
                (() => {
                  const tLates = lateMarksAll.filter(
                    (l) =>
                      l.teacher_name === lateTeacher &&
                      !l.cancelled &&
                      !l.converted,
                  );
                  return tLates.length > 0 ? (
                    <div
                      style={{
                        background: "#FFF7ED",
                        border: "1px solid #FED7AA",
                        borderRadius: 5,
                        padding: "8px 10px",
                        marginBottom: 12,
                        fontSize: 12,
                        color: "#92400E",
                      }}
                    >
                      ⚠ {tLates.length} active late
                      {tLates.length > 1 ? "s" : ""} on record
                      {tLates.length === 1 && (
                        <span style={{ marginLeft: 4 }}>
                          — 1 more will trigger CL deduction
                        </span>
                      )}
                    </div>
                  ) : null;
                })()}

              <button
                onClick={markLate}
                disabled={markingLate || !lateTeacher}
                style={{
                  width: "100%",
                  background: "#92400E",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    markingLate || !lateTeacher ? "not-allowed" : "pointer",
                  opacity: markingLate || !lateTeacher ? 0.6 : 1,
                }}
              >
                {markingLate ? "Marking..." : "Mark as Late"}
              </button>

              <div
                style={{
                  marginTop: 14,
                  background: "#F9FAFB",
                  borderRadius: 5,
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#6B7280",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#374151" }}>Rule:</strong> Every 2 late
                marks = 1 CL deduction. When 2 lates are reached, a CL deduction
                request is automatically sent to HR for approval.
              </div>
            </div>

            {/* Late marks list */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                All Late Marks — AY {schoolYearLabel}
              </div>
              <div style={{ maxHeight: 460, overflowY: "auto" }}>
                {lateMarksAll.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#9CA3AF",
                      fontSize: 13,
                    }}
                  >
                    No late marks this year.
                  </div>
                ) : (
                  lateMarksAll.map((lm) => (
                    <div
                      key={lm.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid #F9FAFB",
                        gap: 10,
                        flexWrap: "wrap",
                        background: lm.cancelled ? "#F9FAFB" : "white",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: lm.cancelled ? "#9CA3AF" : "#111827",
                            textDecoration: lm.cancelled
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {lm.teacher_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 1,
                          }}
                        >
                          {lm.date}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {lm.cancelled && (
                          <span
                            style={{
                              fontSize: 11,
                              background: "#F3F4F6",
                              color: "#6B7280",
                              padding: "2px 8px",
                              borderRadius: 3,
                              fontWeight: 500,
                            }}
                          >
                            Cancelled
                          </span>
                        )}
                        {lm.converted && !lm.cancelled && (
                          <span
                            style={{
                              fontSize: 11,
                              background: "#FEF3C7",
                              color: "#92400E",
                              padding: "2px 8px",
                              borderRadius: 3,
                              fontWeight: 500,
                            }}
                          >
                            → CL Deducted
                          </span>
                        )}
                        {!lm.converted && !lm.cancelled && (
                          <>
                            <span
                              style={{
                                fontSize: 11,
                                background: "#FFF7ED",
                                color: "#9A3412",
                                padding: "2px 8px",
                                borderRadius: 3,
                                fontWeight: 500,
                              }}
                            >
                              Active
                            </span>
                            <button
                              onClick={() => cancelLate(lm)}
                              style={{
                                fontSize: 11,
                                background: "#FEF2F2",
                                color: "#991B1B",
                                border: "1px solid #FECACA",
                                padding: "3px 8px",
                                borderRadius: 3,
                                cursor: "pointer",
                                fontWeight: 500,
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── HOLIDAYS TAB ── */}
        {tab === "holidays" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "300px 1fr",
              gap: 12,
            }}
          >
            {/* Add holiday form */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400E",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                🗓 Add Holiday
              </div>

              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    color: "#111827",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g. Eid ul-Fitr, Diwali..."
                  onKeyDown={(e) => e.key === "Enter" && addHoliday()}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    color: "#111827",
                  }}
                />
              </div>

              <button
                onClick={addHoliday}
                disabled={addingHoliday || !holidayDate || !holidayName.trim()}
                style={{
                  width: "100%",
                  background: "#92400E",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    addingHoliday || !holidayDate || !holidayName.trim()
                      ? 0.6
                      : 1,
                }}
              >
                {addingHoliday ? "Adding..." : "Add Holiday"}
              </button>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#6B7280",
                  lineHeight: 1.6,
                }}
              >
                Holidays are automatically excluded from leave day calculations.
                Sandwich rule may override.
              </div>
            </div>

            {/* Holiday list */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Holidays — AY {schoolYearLabel} ({holidays.length} total)
              </div>
              <div style={{ maxHeight: 460, overflowY: "auto" }}>
                {holidays.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "#9CA3AF",
                      fontSize: 13,
                    }}
                  >
                    No holidays added yet.
                  </div>
                ) : (
                  holidays.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid #F9FAFB",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#111827",
                          }}
                        >
                          {h.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 1,
                          }}
                        >
                          {new Date(h.date + "T00:00:00").toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteHoliday(h.id)}
                        style={{
                          fontSize: 11,
                          background: "#FEF2F2",
                          color: "#991B1B",
                          border: "1px solid #FECACA",
                          padding: "4px 10px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SPECIAL LEAVE TAB ── */}
        {tab === "special" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 12,
            }}
          >
            {/* Grant SL form */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#5B21B6",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                🎁 Grant Special Leave
              </div>

              {slSuccess && (
                <div
                  style={{
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    borderRadius: 5,
                    padding: "8px 10px",
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#065F46",
                    fontWeight: 500,
                  }}
                >
                  ✓ Special leave granted and WhatsApp opened!
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Teacher
                </label>
                <select
                  value={slTeacher}
                  onChange={(e) => setSlTeacher(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Select teacher —</option>
                  {TEACHERS.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#6B7280",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    From
                  </label>
                  <input
                    type="date"
                    value={slFrom}
                    onChange={(e) => {
                      setSlFrom(e.target.value);
                      if (e.target.value > slTo) setSlTo(e.target.value);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 5,
                      border: "1px solid #D1D5DB",
                      fontSize: 13,
                      background: "#FAFAFA",
                      color: "#111827",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#6B7280",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    To
                  </label>
                  <input
                    type="date"
                    value={slTo}
                    min={slFrom}
                    onChange={(e) => setSlTo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 5,
                      border: "1px solid #D1D5DB",
                      fontSize: 13,
                      background: "#FAFAFA",
                      color: "#111827",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "#F5F3FF",
                  borderRadius: 5,
                  padding: "6px 10px",
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#5B21B6",
                  fontWeight: 500,
                }}
              >
                {slDays} working day{slDays > 1 ? "s" : ""} (Sundays & holidays
                excluded)
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 5,
                  }}
                >
                  Reason
                </label>
                <textarea
                  value={slReason}
                  onChange={(e) => setSlReason(e.target.value)}
                  placeholder="Reason for special leave..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 5,
                    border: "1px solid #D1D5DB",
                    fontSize: 13,
                    background: "#FAFAFA",
                    resize: "none",
                    color: "#111827",
                  }}
                />
              </div>

              <button
                onClick={grantSL}
                disabled={grantingSl || !slTeacher || !slReason.trim()}
                style={{
                  width: "100%",
                  background: "#5B21B6",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    grantingSl || !slTeacher || !slReason.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    grantingSl || !slTeacher || !slReason.trim() ? 0.6 : 1,
                }}
              >
                {grantingSl
                  ? "Granting..."
                  : `Grant ${slDays}d Special Leave + Send WhatsApp`}
              </button>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#6B7280",
                  lineHeight: 1.6,
                }}
              >
                Special leave doesn't affect ML or CL balance. WhatsApp
                notification sent automatically.
              </div>
            </div>

            {/* SL history across all teachers */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Special Leaves Granted — AY {schoolYearLabel}
              </div>
              <SpecialLeaveList schoolYear={currentSchoolYear} />
            </div>
          </div>
        )}

        {/* ── TEACHER HISTORY TAB ── */}
        {tab === "teachers" && (
          <div
            className="teacher-history-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #F3F4F6",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6B7280",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                All Teachers
              </div>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {TEACHERS.map((t) => {
                  const bal = balances.find((b) => b.teacher_name === t.name);
                  const isSelected = selectedHistoryTeacher?.name === t.name;
                  const tLates = lateMarksAll.filter(
                    (l) =>
                      l.teacher_name === t.name && !l.cancelled && !l.converted,
                  ).length;
                  return (
                    <button
                      key={t.name}
                      onClick={() => setSelectedHistoryTeacher(t)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        borderBottom: "1px solid #F9FAFB",
                        background: isSelected ? "#3B0764" : "transparent",
                        cursor: "pointer",
                        display: "block",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSelected ? "#F9FAFB" : "#111827",
                          marginBottom: 2,
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: isSelected ? "#C4B5FD" : "#6B7280",
                        }}
                      >
                        ML: {bal?.ml_used ?? 0}/{bal?.ml_limit ?? ML_LIMIT} ·
                        CL: {bal?.cl_used ?? 0}/{bal?.cl_limit ?? CL_LIMIT}
                        {tLates > 0 && (
                          <span
                            style={{
                              marginLeft: 4,
                              color: isSelected ? "#FCD34D" : "#92400E",
                            }}
                          >
                            · {tLates} late{tLates > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <TeacherHistoryPanel
              selectedTeacher={selectedHistoryTeacher}
              onClose={() => setSelectedHistoryTeacher(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Small helper component for SL list
function SpecialLeaveList({ schoolYear }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("special_leaves")
      .select("*")
      .eq("school_year", schoolYear)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setList(data || []);
        setLoading(false);
      });
  }, [schoolYear]);

  if (loading)
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "#9CA3AF",
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    );
  if (list.length === 0)
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#9CA3AF",
          fontSize: 13,
        }}
      >
        No special leaves granted yet.
      </div>
    );

  return (
    <div style={{ maxHeight: 460, overflowY: "auto" }}>
      {list.map((sl) => (
        <div
          key={sl.id}
          style={{ padding: "10px 14px", borderBottom: "1px solid #F9FAFB" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                {sl.teacher_name}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                {sl.from_date} → {sl.to_date}{" "}
                <span
                  style={{
                    background: "#F5F3FF",
                    color: "#5B21B6",
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 600,
                    marginLeft: 4,
                  }}
                >
                  {sl.days_count}d SL
                </span>
              </div>
              {sl.reason && (
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {sl.reason}
                </div>
              )}
            </div>
            <span
              style={{ fontSize: 10, color: "#7C3AED", whiteSpace: "nowrap" }}
            >
              by {sl.granted_by?.toUpperCase()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
