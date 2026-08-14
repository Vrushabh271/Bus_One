from flask import Flask, request
import sqlite3
import secrets
from datetime import date, datetime, timedelta
from pathlib import Path
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Always resolve the database relative to this file, so the backend works
# even when started from a different working directory.
BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR.parent / "Database" / "busone.db"


def get_db_connection():
    conn = sqlite3.connect(str(DATABASE))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_database():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS buses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_number TEXT UNIQUE NOT NULL,
            route TEXT NOT NULL,
            capacity INTEGER NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS driver_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id INTEGER NOT NULL,
            bus_id INTEGER NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (driver_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id),
            UNIQUE(driver_id),
            UNIQUE(bus_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS passenger_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passenger_id INTEGER NOT NULL,
            bus_id INTEGER NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (passenger_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id),
            UNIQUE(passenger_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bus_passes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passenger_id INTEGER NOT NULL,
            bus_id INTEGER NOT NULL,
            pass_type TEXT NOT NULL DEFAULT 'monthly',
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            FOREIGN KEY (passenger_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passenger_id INTEGER NOT NULL,
            bus_id INTEGER NOT NULL,
            attendance_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'present',
            source TEXT NOT NULL DEFAULT 'pass',
            FOREIGN KEY (passenger_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id),
            UNIQUE(passenger_id, attendance_date)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passenger_id INTEGER NOT NULL,
            bus_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_type TEXT NOT NULL,
            payment_status TEXT NOT NULL DEFAULT 'success',
            payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (passenger_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            bus_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (bus_id) REFERENCES buses(id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS attendance_qr (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            qr_token TEXT UNIQUE NOT NULL,
            qr_date TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (bus_id) REFERENCES buses(id),
            FOREIGN KEY (driver_id) REFERENCES users(id),
            UNIQUE(bus_id, qr_date)
        )
    """)

    conn.commit()
    conn.close()


def json_data():
    return request.get_json(silent=True) or {}


@app.route("/", methods=["GET"])
def home():
    return {"success": True, "message": "BusOne Backend is Running!"}, 200


@app.route("/health", methods=["GET"])
def health():
    return {"success": True, "status": "healthy"}, 200


@app.route("/signup", methods=["POST"])
def signup():
    data = json_data()
    full_name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    role = str(data.get("role", "")).strip().lower()
    password = str(data.get("password", ""))

    if not full_name or not email or not role or not password:
        return {"success": False, "message": "All fields are required."}, 400
    if role not in {"admin", "driver", "passenger"}:
        return {"success": False, "message": "Invalid role."}, 400

    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (full_name, email, role, password) VALUES (?, ?, ?, ?)",
            (full_name, email, role, password),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "message": "Email already registered."}, 409
    conn.close()
    return {"success": True, "message": "Account created successfully."}, 201


@app.route("/login", methods=["POST"])
def login():
    data = json_data()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "")).strip().lower()

    if not email or not password or not role:
        return {"success": False, "message": "Email, password and role are required."}, 400

    conn = get_db_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ? AND password = ? AND role = ?",
        (email, password, role),
    ).fetchone()
    conn.close()

    if not user:
        return {"success": False, "message": "Invalid email, password or role."}, 401

    return {
        "success": True,
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        },
    }, 200


@app.route("/buses", methods=["POST"])
def add_bus():
    data = json_data()
    bus_number = str(data.get("bus_number", "")).strip()
    route = str(data.get("route", "")).strip()
    capacity = data.get("capacity")

    if not bus_number or not route or capacity in (None, ""):
        return {"success": False, "message": "All fields are required."}, 400
    try:
        capacity = int(capacity)
        if capacity <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return {"success": False, "message": "Capacity must be a positive number."}, 400

    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO buses (bus_number, route, capacity) VALUES (?, ?, ?)",
            (bus_number, route, capacity),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "message": "Bus number already exists."}, 409
    conn.close()
    return {"success": True, "message": "Bus added successfully."}, 201


@app.route("/buses", methods=["GET"])
def get_buses():
    conn = get_db_connection()
    buses = conn.execute("SELECT * FROM buses ORDER BY id DESC").fetchall()
    conn.close()
    return {"success": True, "buses": [dict(row) for row in buses]}, 200


@app.route("/drivers", methods=["GET"])
def get_drivers():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT u.id, u.full_name, u.email, da.bus_id, b.bus_number, b.route
        FROM users u
        LEFT JOIN driver_assignments da ON u.id = da.driver_id
        LEFT JOIN buses b ON da.bus_id = b.id
        WHERE u.role = 'driver'
        ORDER BY u.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "drivers": [dict(row) for row in rows]}, 200


@app.route("/passengers", methods=["GET"])
def get_passengers():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT u.id, u.full_name, u.email, pa.bus_id, b.bus_number, b.route
        FROM users u
        LEFT JOIN passenger_assignments pa ON u.id = pa.passenger_id
        LEFT JOIN buses b ON pa.bus_id = b.id
        WHERE u.role = 'passenger'
        ORDER BY u.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "passengers": [dict(row) for row in rows]}, 200


@app.route("/driver-assignments", methods=["POST"])
def assign_driver():
    data = json_data()
    driver_id = data.get("driver_id")
    bus_id = data.get("bus_id")
    if not driver_id or not bus_id:
        return {"success": False, "message": "Driver ID and Bus ID are required."}, 400

    conn = get_db_connection()
    driver = conn.execute("SELECT id, full_name FROM users WHERE id = ? AND role = 'driver'", (driver_id,)).fetchone()
    bus = conn.execute("SELECT id, bus_number FROM buses WHERE id = ?", (bus_id,)).fetchone()
    if not driver:
        conn.close()
        return {"success": False, "message": "Driver not found."}, 404
    if not bus:
        conn.close()
        return {"success": False, "message": "Bus not found."}, 404
    try:
        conn.execute("INSERT INTO driver_assignments (driver_id, bus_id) VALUES (?, ?)", (driver_id, bus_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "message": "Driver or bus is already assigned."}, 409
    conn.close()
    return {
        "success": True,
        "message": "Driver assigned to bus successfully.",
        "assignment": {"driver_id": driver_id, "driver_name": driver["full_name"], "bus_id": bus_id, "bus_number": bus["bus_number"]},
    }, 201


@app.route("/driver-assignments", methods=["GET"])
def get_driver_assignments():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT da.id, da.driver_id, u.full_name AS driver_name, u.email AS driver_email,
               da.bus_id, b.bus_number, b.route, b.capacity, da.assigned_at
        FROM driver_assignments da
        INNER JOIN users u ON da.driver_id = u.id
        INNER JOIN buses b ON da.bus_id = b.id
        ORDER BY da.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "assignments": [dict(row) for row in rows]}, 200


@app.route("/passenger-assignments", methods=["POST"])
def assign_passenger():
    data = json_data()
    passenger_id = data.get("passenger_id")
    bus_id = data.get("bus_id")
    if not passenger_id or not bus_id:
        return {"success": False, "message": "Passenger ID and Bus ID are required."}, 400

    conn = get_db_connection()
    passenger = conn.execute("SELECT id, full_name FROM users WHERE id = ? AND role = 'passenger'", (passenger_id,)).fetchone()
    bus = conn.execute("SELECT id, bus_number FROM buses WHERE id = ?", (bus_id,)).fetchone()
    if not passenger:
        conn.close()
        return {"success": False, "message": "Passenger not found."}, 404
    if not bus:
        conn.close()
        return {"success": False, "message": "Bus not found."}, 404
    try:
        conn.execute("INSERT INTO passenger_assignments (passenger_id, bus_id) VALUES (?, ?)", (passenger_id, bus_id))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "message": "Passenger is already assigned to a bus."}, 409
    conn.close()
    return {
        "success": True,
        "message": "Passenger assigned to bus successfully.",
        "assignment": {"passenger_id": passenger_id, "passenger_name": passenger["full_name"], "bus_id": bus_id, "bus_number": bus["bus_number"]},
    }, 201


@app.route("/passenger-assignments", methods=["GET"])
def get_passenger_assignments():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT pa.id, pa.passenger_id, u.full_name AS passenger_name, u.email AS passenger_email,
               pa.bus_id, b.bus_number, b.route, pa.assigned_at
        FROM passenger_assignments pa
        INNER JOIN users u ON pa.passenger_id = u.id
        INNER JOIN buses b ON pa.bus_id = b.id
        ORDER BY pa.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "assignments": [dict(row) for row in rows]}, 200


@app.route("/driver-assignments/<int:driver_id>", methods=["DELETE"])
def remove_driver_assignment(driver_id):
    conn = get_db_connection()
    deleted = conn.execute("DELETE FROM driver_assignments WHERE driver_id = ?", (driver_id,)).rowcount
    conn.commit()
    conn.close()
    if deleted == 0:
        return {"success": False, "message": "No driver assignment found."}, 404
    return {"success": True, "message": "Driver assignment removed successfully."}, 200


@app.route("/passenger-assignments/<int:passenger_id>", methods=["DELETE"])
def remove_passenger_assignment(passenger_id):
    conn = get_db_connection()
    deleted = conn.execute("DELETE FROM passenger_assignments WHERE passenger_id = ?", (passenger_id,)).rowcount
    conn.commit()
    conn.close()
    if deleted == 0:
        return {"success": False, "message": "No passenger assignment found."}, 404
    return {"success": True, "message": "Passenger assignment removed successfully."}, 200


@app.route("/buses/<int:bus_id>", methods=["DELETE"])
def delete_bus(bus_id):
    conn = get_db_connection()
    try:
        deleted = conn.execute("DELETE FROM buses WHERE id = ?", (bus_id,)).rowcount
        conn.commit()
    finally:
        conn.close()
    if deleted == 0:
        return {"success": False, "message": "Bus not found."}, 404
    return {"success": True, "message": "Bus deleted successfully."}, 200


@app.route("/driver/<int:driver_id>/bus", methods=["GET"])
def get_driver_bus(driver_id):
    conn = get_db_connection()
    row = conn.execute("""
        SELECT b.id, b.bus_number, b.route, b.capacity
        FROM driver_assignments da
        INNER JOIN buses b ON da.bus_id = b.id
        WHERE da.driver_id = ?
    """, (driver_id,)).fetchone()
    conn.close()
    if not row:
        return {"success": False, "message": "No bus assigned."}, 404
    return {"success": True, "bus": dict(row)}, 200


@app.route("/passenger/<int:passenger_id>/bus", methods=["GET"])
def get_passenger_bus(passenger_id):
    conn = get_db_connection()
    row = conn.execute("""
        SELECT b.id, b.bus_number, b.route, b.capacity
        FROM passenger_assignments pa
        INNER JOIN buses b ON pa.bus_id = b.id
        WHERE pa.passenger_id = ?
    """, (passenger_id,)).fetchone()
    conn.close()
    if not row:
        return {"success": False, "message": "No bus assigned."}, 404
    return {"success": True, "bus": dict(row)}, 200


@app.route("/driver/attendance-qr", methods=["POST"])
def generate_attendance_qr():
    data = json_data()
    driver_id = data.get("driver_id")
    if not driver_id:
        return {"success": False, "message": "Driver ID is required."}, 400

    conn = get_db_connection()
    driver = conn.execute("SELECT id, full_name FROM users WHERE id = ? AND role = 'driver'", (driver_id,)).fetchone()
    if not driver:
        conn.close()
        return {"success": False, "message": "Driver not found."}, 404

    assignment = conn.execute("""
        SELECT da.bus_id, b.bus_number, b.route, b.capacity
        FROM driver_assignments da
        INNER JOIN buses b ON da.bus_id = b.id
        WHERE da.driver_id = ?
    """, (driver_id,)).fetchone()
    if not assignment:
        conn.close()
        return {"success": False, "message": "No bus assigned to this driver."}, 404

    today = date.today().isoformat()
    existing = conn.execute("SELECT * FROM attendance_qr WHERE bus_id = ? AND qr_date = ?", (assignment["bus_id"], today)).fetchone()
    if existing:
        conn.close()
        return {"success": True, "message": "Today's QR already exists.", "qr": {
            "token": existing["qr_token"], "date": existing["qr_date"], "expires_at": existing["expires_at"],
            "bus_id": assignment["bus_id"], "bus_number": assignment["bus_number"], "route": assignment["route"]
        }}, 200

    token = secrets.token_urlsafe(32)
    tomorrow = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())
    expires_at = tomorrow.isoformat()
    conn.execute("""
        INSERT INTO attendance_qr (bus_id, driver_id, qr_token, qr_date, expires_at)
        VALUES (?, ?, ?, ?, ?)
    """, (assignment["bus_id"], driver_id, token, today, expires_at))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Today's attendance QR generated.", "qr": {
        "token": token, "date": today, "expires_at": expires_at,
        "bus_id": assignment["bus_id"], "bus_number": assignment["bus_number"], "route": assignment["route"]
    }}, 201


def scan_attendance_common(data):
    passenger_id = data.get("passenger_id")
    qr_token = data.get("qr_token") or data.get("token")
    if not passenger_id or not qr_token:
        return {"success": False, "message": "Passenger ID and QR token are required."}, 400

    conn = get_db_connection()
    passenger = conn.execute("SELECT id, full_name FROM users WHERE id = ? AND role = 'passenger'", (passenger_id,)).fetchone()
    if not passenger:
        conn.close()
        return {"success": False, "message": "Passenger not found."}, 404

    qr = conn.execute("""
        SELECT aq.*, b.bus_number, b.route
        FROM attendance_qr aq
        INNER JOIN buses b ON aq.bus_id = b.id
        WHERE aq.qr_token = ?
    """, (qr_token,)).fetchone()
    if not qr:
        conn.close()
        return {"success": False, "message": "Invalid QR code."}, 400

    now = datetime.now()
    try:
        expires_at = datetime.fromisoformat(qr["expires_at"])
    except ValueError:
        expires_at = now
    if qr["qr_date"] != date.today().isoformat() or now >= expires_at:
        conn.close()
        return {"success": False, "message": "This QR code has expired."}, 400

    assignment = conn.execute("SELECT id FROM passenger_assignments WHERE passenger_id = ? AND bus_id = ?", (passenger_id, qr["bus_id"])).fetchone()
    if not assignment:
        conn.close()
        return {"success": False, "message": "You are not assigned to this bus."}, 403

    existing = conn.execute("SELECT id FROM attendance WHERE passenger_id = ? AND attendance_date = ?", (passenger_id, date.today().isoformat())).fetchone()
    if existing:
        conn.close()
        return {"success": False, "message": "Attendance already marked for today."}, 409

    conn.execute("""
        INSERT INTO attendance (passenger_id, bus_id, attendance_date, status, source)
        VALUES (?, ?, ?, 'present', 'qr')
    """, (passenger_id, qr["bus_id"], date.today().isoformat()))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Attendance marked successfully.", "attendance": {
        "passenger": passenger["full_name"], "bus_number": qr["bus_number"], "route": qr["route"],
        "date": date.today().isoformat(), "status": "present"
    }, "bus_number": qr["bus_number"], "route": qr["route"]}, 201


@app.route("/attendance/scan", methods=["POST"])
def scan_attendance():
    result, status = scan_attendance_common(json_data())
    return result, status


# Frontend-compatible alias.
@app.route("/passenger/scan-qr", methods=["POST"])
def passenger_scan_qr():
    result, status = scan_attendance_common(json_data())
    return result, status


@app.route("/passenger/<int:passenger_id>/attendance", methods=["GET"])
def passenger_attendance(passenger_id):
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT a.id, a.attendance_date, a.status, a.source, b.bus_number, b.route
        FROM attendance a
        INNER JOIN buses b ON a.bus_id = b.id
        WHERE a.passenger_id = ?
        ORDER BY a.attendance_date DESC
    """, (passenger_id,)).fetchall()
    conn.close()
    records = [dict(row) for row in rows]
    return {"success": True, "attendance": records, "present_days": sum(r["status"] == "present" for r in records)}, 200


@app.route("/passes", methods=["GET"])
def get_passes():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT bp.id, bp.passenger_id, u.full_name AS passenger_name, bp.bus_id,
               b.bus_number, bp.pass_type, bp.start_date, bp.end_date, bp.status
        FROM bus_passes bp
        INNER JOIN users u ON bp.passenger_id = u.id
        INNER JOIN buses b ON bp.bus_id = b.id
        ORDER BY bp.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "passes": [dict(row) for row in rows]}, 200


@app.route("/passes", methods=["POST"])
def create_pass():
    data = json_data()
    passenger_id = data.get("passenger_id")
    bus_id = data.get("bus_id")
    pass_type = str(data.get("pass_type", "monthly")).strip().lower()
    start_date = str(data.get("start_date", date.today().isoformat()))
    end_date = str(data.get("end_date", (date.today() + timedelta(days=30)).isoformat()))
    if not passenger_id or not bus_id:
        return {"success": False, "message": "Passenger ID and Bus ID are required."}, 400
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO bus_passes (passenger_id, bus_id, pass_type, start_date, end_date, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        """, (passenger_id, bus_id, pass_type, start_date, end_date))
        conn.commit()
    except sqlite3.IntegrityError as exc:
        conn.close()
        return {"success": False, "message": f"Unable to create pass: {exc}"}, 400
    conn.close()
    return {"success": True, "message": "Bus pass created successfully."}, 201


@app.route("/payments", methods=["GET"])
def get_payments():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT p.id, p.passenger_id, u.full_name AS passenger_name, p.bus_id,
               b.bus_number, p.amount, p.payment_type, p.payment_status, p.payment_date
        FROM payments p
        INNER JOIN users u ON p.passenger_id = u.id
        INNER JOIN buses b ON p.bus_id = b.id
        ORDER BY p.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "payments": [dict(row) for row in rows]}, 200


@app.route("/payments", methods=["POST"])
def create_payment():
    data = json_data()
    passenger_id = data.get("passenger_id")
    bus_id = data.get("bus_id")
    amount = data.get("amount", 50)
    payment_type = str(data.get("payment_type", "one-day-pass"))
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return {"success": False, "message": "Amount must be a number."}, 400
    if not passenger_id or not bus_id:
        return {"success": False, "message": "Passenger ID and Bus ID are required."}, 400
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO payments (passenger_id, bus_id, amount, payment_type, payment_status)
        VALUES (?, ?, ?, ?, 'success')
    """, (passenger_id, bus_id, amount, payment_type))
    conn.commit()
    payment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"success": True, "message": "Payment successful.", "payment_id": payment_id}, 201


@app.route("/notifications", methods=["GET"])
def get_all_notifications():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT n.id, n.user_id, u.full_name AS user_name, u.role, n.bus_id, b.bus_number,
               n.title, n.message, n.is_read, n.created_at
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        LEFT JOIN buses b ON n.bus_id = b.id
        ORDER BY n.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "notifications": [dict(row) for row in rows]}, 200


@app.route("/notifications/<int:user_id>", methods=["GET"])
def get_notifications(user_id):
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT id, user_id, bus_id, title, message, is_read, created_at
        FROM notifications WHERE user_id = ? ORDER BY id DESC
    """, (user_id,)).fetchall()
    conn.close()
    return {"success": True, "notifications": [dict(row) for row in rows]}, 200


@app.route("/notifications", methods=["POST"])
def create_notification():
    data = json_data()
    user_id = data.get("user_id")
    title = str(data.get("title", "")).strip()
    message = str(data.get("message", "")).strip()
    bus_id = data.get("bus_id")

    if not user_id or not title or not message:
        return {"success": False, "message": "User, title and message are required."}, 400

    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO notifications (user_id, bus_id, title, message)
            VALUES (?, ?, ?, ?)
        """, (user_id, bus_id, title, message))
        conn.commit()
        notification_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    finally:
        conn.close()
    return {"success": True, "message": "Notification sent successfully.", "notification_id": notification_id}, 201


@app.route("/attendance", methods=["GET"])
def get_all_attendance():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT a.id, a.attendance_date, a.status, a.source,
               u.full_name AS passenger_name, b.bus_number, b.route
        FROM attendance a
        INNER JOIN users u ON a.passenger_id = u.id
        INNER JOIN buses b ON a.bus_id = b.id
        ORDER BY a.attendance_date DESC, a.id DESC
    """).fetchall()
    conn.close()
    return {"success": True, "attendance": [dict(row) for row in rows]}, 200


if __name__ == "__main__":
    create_database()
    print(f"BusOne database: {DATABASE}")
    app.run(host="0.0.0.0", port=5000, debug=True)
