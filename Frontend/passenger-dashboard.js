document.addEventListener("DOMContentLoaded", () => {
    const API = `${window.location.protocol}//${window.location.hostname}:5000`;
    const userData = localStorage.getItem("busOneUser");

    if (!userData) {
        alert("Please login first.");
        window.location.href = "index.html";
        return;
    }

    let user;
    try {
        user = JSON.parse(userData);
    } catch (error) {
        localStorage.removeItem("busOneUser");
        window.location.href = "index.html";
        return;
    }

    if (!user.id || user.role !== "passenger") {
        alert("Passenger account required.");
        window.location.href = "index.html";
        return;
    }

    const firstName = user.full_name ? user.full_name.split(" ")[0] : "Passenger";
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText("welcomeText", `Welcome back, ${firstName} 👋`);
    setText("profileInitial", firstName.charAt(0).toUpperCase());

    const startBtn = document.getElementById("startScannerBtn");
    const stopBtn = document.getElementById("stopScannerBtn");
    const scanMessage = document.getElementById("scanMessage");
    const todayAttendance = document.getElementById("todayAttendance");
    const payBtn = document.getElementById("payBtn");
    let scanner = null;
    let scannerRunning = false;
    let scanLocked = false;

    async function stopScanner() {
        if (!scanner || !scannerRunning) return;
        try {
            await scanner.stop();
            scanner.clear();
        } catch (error) {
            console.warn("Scanner stop:", error);
        }
        scannerRunning = false;
        if (startBtn) startBtn.classList.remove("d-none");
        if (stopBtn) stopBtn.classList.add("d-none");
    }

    async function markAttendance(token) {
        if (scanLocked) return;
        scanLocked = true;
        await stopScanner();

        if (scanMessage) {
            scanMessage.innerHTML = `<div class="alert alert-warning"><span class="spinner-border spinner-border-sm me-2"></span>Verifying QR and marking attendance...</div>`;
        }

        try {
            const response = await fetch(`${API}/passenger/scan-qr`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ passenger_id: user.id, token })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                if (scanMessage) {
                    scanMessage.innerHTML = `<div class="alert alert-danger"><i class="bi bi-x-circle-fill me-1"></i><strong>Attendance Failed</strong><br>${result.message || "Invalid QR."}</div>`;
                }
                return;
            }

            if (scanMessage) {
                scanMessage.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle-fill me-1"></i><strong>Attendance Marked Successfully!</strong><br><small>Bus: ${result.bus_number || "Assigned Bus"}</small></div>`;
            }
            if (todayAttendance) {
                todayAttendance.innerHTML = `<i class="bi bi-check-circle-fill"></i> <strong>Present</strong> — Today's attendance has been recorded.`;
                todayAttendance.className = "alert alert-success mb-0";
            }
            await loadAttendance();
        } catch (error) {
            console.error("Attendance error:", error);
            if (scanMessage) {
                scanMessage.innerHTML = `<div class="alert alert-danger"><i class="bi bi-wifi-off me-1"></i>Unable to connect to BusOne server.</div>`;
            }
        } finally {
            setTimeout(() => { scanLocked = false; }, 1000);
        }
    }

    if (startBtn) {
        startBtn.addEventListener("click", async () => {
            if (scannerRunning) return;
            if (typeof Html5Qrcode === "undefined") {
                scanMessage.innerHTML = `<div class="alert alert-danger">QR scanner library could not be loaded. Check your internet connection.</div>`;
                return;
            }
            scanMessage.innerHTML = `<div class="alert alert-info"><i class="bi bi-camera-fill me-1"></i>Camera starting...</div>`;
            scanner = new Html5Qrcode("reader");
            try {
                await scanner.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    async (decodedText) => await markAttendance(decodedText),
                    () => {}
                );
                scannerRunning = true;
                startBtn.classList.add("d-none");
                stopBtn.classList.remove("d-none");
                scanMessage.innerHTML = `<div class="alert alert-primary"><i class="bi bi-camera-fill me-1"></i>Scanner active. Point your camera at the driver's QR.</div>`;
            } catch (error) {
                console.error(error);
                scanMessage.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Camera permission denied or unavailable. Open this page through localhost/HTTPS.</div>`;
            }
        });
    }

    if (stopBtn) stopBtn.addEventListener("click", stopScanner);

    async function loadPassengerBus() {
        try {
            const response = await fetch(`${API}/passenger/${user.id}/bus`);
            const result = await response.json();
            if (!response.ok || !result.success) {
                setText("myBusNumber", "Not Assigned");
                setText("myBusRoute", "No bus assigned");
                setText("busNumberLarge", "Not Assigned");
                setText("routeLarge", "No route assigned");
                return;
            }
            const bus = result.bus;
            setText("myBusNumber", bus.bus_number);
            setText("myBusRoute", bus.route);
            setText("busNumberLarge", bus.bus_number);
            setText("routeLarge", bus.route);
            localStorage.setItem("busOnePassengerBus", JSON.stringify(bus));
        } catch (error) {
            console.error("Bus loading error:", error);
        }
    }

    async function loadAttendance() {
        try {
            const response = await fetch(`${API}/passenger/${user.id}/attendance`);
            const result = await response.json();
            if (!response.ok || !result.success) return;
            const records = result.attendance || [];
            const today = new Date().toISOString().slice(0, 10);
            const presentToday = records.some(r => r.attendance_date === today && r.status === "present");
            if (presentToday && todayAttendance) {
                todayAttendance.innerHTML = `<i class="bi bi-check-circle-fill"></i> <strong>Present</strong> — Today's attendance has been recorded.`;
                todayAttendance.className = "alert alert-success mb-0";
            }
            const percentageEl = document.getElementById("attendancePercentage");
            if (percentageEl && records.length) {
                const present = records.filter(r => r.status === "present").length;
                percentageEl.textContent = `${Math.round((present / records.length) * 100)}%`;
            }
        } catch (error) {
            console.warn("Attendance loading error:", error);
        }
    }

    async function loadNotifications() {
        const list = document.getElementById("notificationsList");
        if (!list) return;
        try {
            const response = await fetch(`${API}/notifications/${user.id}`);
            const result = await response.json();
            if (!response.ok || !result.success || !result.notifications.length) return;
            list.innerHTML = result.notifications.map(n => `
                <div class="d-flex gap-3 mb-3">
                    <i class="bi bi-bell-fill text-warning fs-5"></i>
                    <div><div class="fw-semibold">${n.title}</div><small class="text-muted">${n.message}</small></div>
                </div>`).join("");
        } catch (error) {
            console.warn("Notifications loading error:", error);
        }
    }

    if (payBtn) {
        payBtn.addEventListener("click", async () => {
            try {
                const busResponse = await fetch(`${API}/passenger/${user.id}/bus`);
                const busResult = await busResponse.json();
                if (!busResponse.ok || !busResult.success) {
                    alert("You need a bus assignment before purchasing a one-day pass.");
                    return;
                }
                const response = await fetch(`${API}/payments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ passenger_id: user.id, bus_id: busResult.bus.id, amount: 50, payment_type: "one-day-pass" })
                });
                const result = await response.json();
                alert(result.message || "Payment completed.");
            } catch (error) {
                alert("Unable to connect to BusOne server.");
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("busOneUser");
            localStorage.removeItem("busOnePassengerBus");
            window.location.href = "index.html";
        });
    }

    loadPassengerBus();
    loadAttendance();
    loadNotifications();
});
