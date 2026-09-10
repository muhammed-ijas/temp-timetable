import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  TEACHERS,
  ADMIN_PASSWORD,
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

const today = () => new Date().toISOString().split("T")[0];

function Badge({ status, exceeded, vpStatus }) {
  if (vpStatus === "approved" && status === "pending")
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
        ✓ VP Approved
      </span>
    );
  if (vpStatus === "pending" && status === "pending")
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
  const map = {
    pending: exceeded
      ? {
          label: "Limit Exceeded",
          color: "#92400E",
          bg: "#FEF3C7",
          border: "#FCD34D",
        }
      : {
          label: "Pending",
          color: "#1E40AF",
          bg: "#EFF6FF",
          border: "#BFDBFE",
        },
    approved: {
      label: "Approved",
      color: "#065F46",
      bg: "#ECFDF5",
      border: "#6EE7B7",
    },
    rejected: {
      label: "Rejected",
      color: "#991B1B",
      bg: "#FEF2F2",
      border: "#FECACA",
    },
    cancelled: {
      label: "Cancelled",
      color: "#4B5563",
      bg: "#F3F4F6",
      border: "#D1D5DB",
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 600,
      }}
    >
      {s.label}
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
  const msg = `Hi ${teacherName},\n\nYour ${leaveType === "ML" ? "Medical Leave" : leaveType === "SL" ? "Special Leave" : leaveType === "CL" && action === "approved" ? "leave" : "Casual Leave"} request from ${fromDate} to ${toDate} (${days} day${days > 1 ? "s" : ""}) has been *${action === "approved" ? "Approved ✓" : "Rejected ✗"}* by HR.\n\n— PGS Management`;
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const currentSchoolYear = getSchoolYear();
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear);

  const [tab, setTab] = useState("requests");
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [actioned, setActioned] = useState({});
  const [editingBalance, setEditingBalance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedHistoryTeacher, setSelectedHistoryTeacher] = useState(null);

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
    if (sessionStorage.getItem("pgs_admin") !== ADMIN_PASSWORD) {
      navigate("/");
      return;
    }
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: reqs }, { data: bals }, { data: hols }] = await Promise.all([
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
    ]);
    setRequests(reqs || []);
    setHolidays(hols || []);
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
            lwp_count: 0,
            sl_granted: 0,
            ml_limit: ML_LIMIT,
            cl_limit: CL_LIMIT,
            school_year: currentSchoolYear,
            id: null,
          },
      ),
    );
    setLoading(false);
  }

  async function handleAction(req, action) {
    await supabase
      .from("leave_requests")
      .update({ status: action })
      .eq("id", req.id);

    if (action === "approved") {
      const { data: existingBal } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("teacher_name", req.teacher_name)
        .eq("school_year", currentSchoolYear)
        .maybeSingle();

      if (req.leave_type === "CL" || req.leave_type === "ML") {
        const field = req.leave_type === "ML" ? "ml_used" : "cl_used";
        const balanceDays = req.days_count - (req.lwp_days || 0);
        const lwpDays = req.lwp_days || 0;
        if (existingBal) {
          await supabase
            .from("leave_balances")
            .update({
              [field]: (existingBal[field] || 0) + balanceDays,
              lwp_count: (existingBal.lwp_count || 0) + lwpDays,
            })
            .eq("id", existingBal.id);
        } else {
          await supabase
            .from("leave_balances")
            .insert({
              teacher_name: req.teacher_name,
              [field]: balanceDays,
              lwp_count: lwpDays,
              ml_limit: ML_LIMIT,
              cl_limit: CL_LIMIT,
              school_year: currentSchoolYear,
              year: currentSchoolYear,
            });
        }
      }
      // SL doesn't touch balance — already handled at grant time

      // Send WhatsApp for late→CL auto requests
      if (req.is_auto_generated) {
        const phone = TEACHERS.find((t) => t.name === req.teacher_name)?.phone;
        if (phone) {
          const msg = `Hi ${req.teacher_name},\n\nDue to late arrivals, *${req.days_count} Casual Leave* has been deducted from your balance as per school policy.\n\n— PGS Management`;
          window.open(
            `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
            "_blank",
          );
        }
      }
    }

    setActioned((p) => ({ ...p, [req.id]: action }));
    setRequests((p) =>
      p.map((r) => (r.id === req.id ? { ...r, status: action } : r)),
    );
    await fetchAll();
  }

  async function cancelApproval(req) {
    if (
      !window.confirm(
        `Cancel approval for ${req.teacher_name}'s ${req.leave_type} leave (${req.days_count} days)? This will restore their balance.`,
      )
    )
      return;
    await supabase
      .from("leave_requests")
      .update({ status: "cancelled" })
      .eq("id", req.id);
    if (req.leave_type === "ML" || req.leave_type === "CL") {
      const field = req.leave_type === "ML" ? "ml_used" : "cl_used";
      const { data: existingBal } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("teacher_name", req.teacher_name)
        .eq("school_year", currentSchoolYear)
        .maybeSingle();
      if (existingBal?.id) {
        await supabase
          .from("leave_balances")
          .update({
            [field]: Math.max(
              0,
              (existingBal[field] || 0) -
                (req.days_count - (req.lwp_days || 0)),
            ),
            lwp_count: Math.max(
              0,
              (existingBal.lwp_count || 0) - (req.lwp_days || 0),
            ),
          })
          .eq("id", existingBal.id);
      }
    }
    setRequests((p) =>
      p.map((r) => (r.id === req.id ? { ...r, status: "cancelled" } : r)),
    );
    await fetchAll();
  }

  async function saveBalance() {
    if (!editingBalance) return;
    setSaving(true);
    const { id, teacher_name, ml_used, cl_used, ml_limit, cl_limit } =
      editingBalance;
    const payload = {
      ml_used: Number(ml_used),
      cl_used: Number(cl_used),
      ml_limit: Number(ml_limit),
      cl_limit: Number(cl_limit),
      school_year: currentSchoolYear,
      teacher_name,
    };
    if (id) {
      await supabase.from("leave_balances").update(payload).eq("id", id);
    } else {
      await supabase.from("leave_balances").insert(payload);
    }
    setSaving(false);
    setEditingBalance(null);
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
          created_by: "hr",
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
      granted_by: "hr",
      school_year: currentSchoolYear,
    });

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

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending" && !r.exceeded)
      .length,
    exceeded: requests.filter((r) => r.exceeded && r.status === "pending")
      .length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    cancelled: requests.filter((r) => r.status === "cancelled").length,
  };

  const filtered =
    filter === "all"
      ? requests
      : filter === "exceeded"
        ? requests.filter((r) => r.exceeded && r.status === "pending")
        : requests.filter((r) => r.status === filter);

  const slDays = countLeaveDays(
    slFrom,
    slTo,
    holidays.map((h) => h.date),
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3F4F6",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #111827; border-color: #111827 !important; }
        @media (max-width: 640px) { .header-wrap { padding: 10px 14px !important; } .page-wrap { padding: 10px !important; } .stats-grid { grid-template-columns: 1fr 1fr !important; } .bal-table { font-size: 11px !important; } .teacher-history-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <header
        style={{
          background: "#111827",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="header-wrap"
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "9px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/logo.png"
              alt="PGS"
              style={{ height: 32, objectFit: "contain" }}
              onError={(e) => (e.target.style.display = "none")}
            />
            <div>
              <div
                style={{
                  color: "#9CA3AF",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Premier Global School
              </div>
              <div style={{ color: "#F9FAFB", fontSize: 14, fontWeight: 700 }}>
                HR Dashboard
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#6B7280", fontSize: 11 }}>
              AY {schoolYearLabel}
            </span>
            <button
              onClick={() => {
                sessionStorage.removeItem("pgs_admin");
                navigate("/");
              }}
              style={{
                background: "transparent",
                border: "1px solid #374151",
                color: "#9CA3AF",
                padding: "6px 12px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      <div
        className="page-wrap"
        style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px" }}
      >
        {/* Stats */}
        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            { label: "Total", val: counts.all, color: "#111827", bg: "#fff" },
            {
              label: "Pending",
              val: counts.pending,
              color: "#1E40AF",
              bg: "#EFF6FF",
            },
            {
              label: "Exceeded",
              val: counts.exceeded,
              color: "#92400E",
              bg: "#FEF3C7",
            },
            {
              label: "Approved",
              val: counts.approved,
              color: "#065F46",
              bg: "#ECFDF5",
            },
            {
              label: "Holidays",
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
                  opacity: 0.7,
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
            background: "#E5E7EB",
            borderRadius: 7,
            padding: 3,
            width: "fit-content",
            flexWrap: "wrap",
          }}
        >
          {[
            ["requests", "Leave Requests"],
            ["holidays", "Holidays"],
            ["special", "Special Leave"],
            ["teachers", "Teacher History"],
            ["balances", "Balances"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "6px 14px",
                borderRadius: 5,
                border: "none",
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#111827" : "#6B7280",
                fontWeight: tab === key ? 600 : 500,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
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
                ["all", "All"],
                ["pending", "Pending"],
                ["exceeded", "Exceeded"],
                ["approved", "Approved"],
                ["rejected", "Rejected"],
                ["cancelled", "Cancelled"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${filter === key ? "#111827" : "#D1D5DB"}`,
                    background: filter === key ? "#111827" : "#fff",
                    color: filter === key ? "#fff" : "#374151",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                  {counts[key] > 0 ? ` (${counts[key]})` : ""}
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
                const vpApproved = req.vp_status === "approved";
                const vpPending = req.vp_status === "pending";
                return (
                  <div
                    key={req.id}
                    style={{
                      background: "#fff",
                      border: `1px solid ${vpPending && req.status === "pending" ? "#DDD6FE" : req.exceeded && req.status === "pending" ? "#FCD34D" : "#E5E7EB"}`,
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
                                : req.leave_type === "CL" &&
                                    req.is_auto_generated
                                  ? "Late→CL"
                                  : "Casual"}
                          </span>
                          <Badge
                            status={req.status}
                            exceeded={req.exceeded}
                            vpStatus={req.vp_status}
                          />
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
                              Auto-generated
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
                            marginBottom: 2,
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
                          req.leave_type === "ML" &&
                          !req.is_auto_generated && (
                            <span style={{ fontSize: 11, color: "#92400E" }}>
                              No document uploaded
                            </span>
                          )
                        )}
                        {req.exceeded && req.status === "pending" && (
                          <div
                            style={{
                              marginTop: 5,
                              fontSize: 11,
                              color: "#92400E",
                              background: "#FEF3C7",
                              padding: "3px 8px",
                              borderRadius: 3,
                              display: "inline-block",
                            }}
                          >
                            Limit exceeded — urgent
                          </div>
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
                        {req.status === "pending" && vpApproved && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleAction(req, "approved")}
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
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(req, "rejected")}
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
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status === "pending" && vpPending && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#5B21B6",
                              background: "#F5F3FF",
                              border: "1px solid #DDD6FE",
                              padding: "6px 12px",
                              borderRadius: 5,
                              fontWeight: 500,
                            }}
                          >
                            Waiting for VP
                          </div>
                        )}
                        {req.status === "approved" && (
                          <button
                            onClick={() => cancelApproval(req)}
                            style={{
                              background: "#FFF7ED",
                              color: "#9A3412",
                              border: "1px solid #FED7AA",
                              padding: "6px 12px",
                              borderRadius: 5,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Cancel Approval
                          </button>
                        )}
                        {(req.status !== "pending" || actioned[req.id]) &&
                          phone && (
                            <button
                              onClick={() =>
                                openWhatsApp(
                                  phone,
                                  req.teacher_name,
                                  req.leave_type,
                                  req.from_date,
                                  req.to_date,
                                  req.days_count,
                                  req.status,
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
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              WhatsApp
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

        {/* ── HOLIDAYS TAB ── */}
        {tab === "holidays" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "300px 1fr",
              gap: 12,
            }}
          >
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
                  background: "#111827",
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
              </div>
            </div>
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
                  : `Grant ${slDays}d Special Leave + WhatsApp`}
              </button>
            </div>
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
                        background: isSelected ? "#111827" : "transparent",
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
                          color: isSelected ? "#9CA3AF" : "#6B7280",
                        }}
                      >
                        ML: {bal?.ml_used ?? 0}/{bal?.ml_limit ?? ML_LIMIT} ·
                        CL: {bal?.cl_used ?? 0}/{bal?.cl_limit ?? CL_LIMIT}
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

        {/* ── BALANCES TAB ── */}
        {tab === "balances" && (
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                Teacher Leave Balances — AY {schoolYearLabel}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                Click Edit to modify
              </div>
            </div>
            <div
              className="bal-table"
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 80px",
                gap: 0,
                padding: "7px 14px",
                background: "#F9FAFB",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              {[
                "Teacher",
                "ML Used",
                "ML Limit",
                "CL Used",
                "CL Limit",
                "LWP",
                "SL",
                "",
              ].map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {loading ? (
              <div
                style={{
                  padding: 20,
                  color: "#9CA3AF",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Loading...
              </div>
            ) : (
              balances.map((bal) => (
                <div
                  key={bal.teacher_name}
                  className="bal-table"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 80px",
                    gap: 0,
                    padding: "9px 14px",
                    borderBottom: "1px solid #F9FAFB",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}
                  >
                    {bal.teacher_name}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        color:
                          bal.ml_used >= (bal.ml_limit || ML_LIMIT)
                            ? "#991B1B"
                            : "#374151",
                        fontWeight:
                          bal.ml_used >= (bal.ml_limit || ML_LIMIT) ? 700 : 400,
                      }}
                    >
                      {bal.ml_used}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {bal.ml_limit || ML_LIMIT}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        color:
                          bal.cl_used >= (bal.cl_limit || CL_LIMIT)
                            ? "#991B1B"
                            : "#374151",
                        fontWeight:
                          bal.cl_used >= (bal.cl_limit || CL_LIMIT) ? 700 : 400,
                      }}
                    >
                      {bal.cl_used}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {bal.cl_limit || CL_LIMIT}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: bal.lwp_count > 0 ? "#991B1B" : "#374151",
                      fontWeight: bal.lwp_count > 0 ? 700 : 400,
                    }}
                  >
                    {bal.lwp_count ?? 0}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: bal.sl_granted > 0 ? "#5B21B6" : "#374151",
                      fontWeight: bal.sl_granted > 0 ? 700 : 400,
                    }}
                  >
                    {bal.sl_granted ?? 0}
                  </div>
                  <button
                    onClick={() =>
                      setEditingBalance({
                        ...bal,
                        ml_limit: bal.ml_limit || ML_LIMIT,
                        cl_limit: bal.cl_limit || CL_LIMIT,
                      })
                    }
                    style={{
                      background: "#F3F4F6",
                      border: "1px solid #E5E7EB",
                      color: "#374151",
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Balance Modal */}
      {editingBalance && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 22,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                marginBottom: 2,
              }}
            >
              Edit Leave Balance
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
              {editingBalance.teacher_name} — AY {schoolYearLabel}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                ["ml_used", "ML Used"],
                ["ml_limit", "ML Limit"],
                ["cl_used", "CL Used"],
                ["cl_limit", "CL Limit"],
              ].map(([field, label]) => (
                <div key={field}>
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
                    {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={editingBalance[field]}
                    onChange={(e) =>
                      setEditingBalance((p) => ({
                        ...p,
                        [field]: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 5,
                      border: "1px solid #D1D5DB",
                      fontSize: 14,
                      color: "#111827",
                      background: "#FAFAFA",
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: 5,
                padding: "8px 10px",
                fontSize: 12,
                color: "#92400E",
                marginBottom: 14,
              }}
            >
              Changing "Used" affects remaining balance. "Limit" sets a custom
              cap.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setEditingBalance(null)}
                style={{
                  flex: 1,
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  padding: "9px",
                  borderRadius: 5,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#374151",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveBalance}
                disabled={saving}
                style={{
                  flex: 1,
                  background: "#111827",
                  border: "none",
                  padding: "9px",
                  borderRadius: 5,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  color: "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
                {sl.from_date} → {sl.to_date}
                <span
                  style={{
                    background: "#F5F3FF",
                    color: "#5B21B6",
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 600,
                    marginLeft: 6,
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
