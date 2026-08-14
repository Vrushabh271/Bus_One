document.addEventListener('DOMContentLoaded', async () => {
  const API = `${window.location.protocol}//${window.location.hostname}:5000`;

  const ensureLoggedIn = () => {
    const user = localStorage.getItem('busOneUser');
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }

    try {
      const parsed = JSON.parse(user);
      if (parsed.role !== 'admin') {
        alert('Admin account required.');
        window.location.href = 'index.html';
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem('busOneUser');
      window.location.href = 'index.html';
      return null;
    }
  };

  const adminUser = ensureLoggedIn();
  if (!adminUser) return;

  const buildSelect = (id, options, placeholder) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>` + options.map((item) => `
      <option value="${item.value}">${item.label}</option>
    `).join('');
  };

  const loadData = async () => {
    try {
      const [busesRes, driversRes, passengersRes, passesRes, attendanceRes, notificationsRes] = await Promise.all([
        fetch(`${API}/buses`),
        fetch(`${API}/drivers`),
        fetch(`${API}/passengers`),
        fetch(`${API}/passes`),
        fetch(`${API}/attendance`),
        fetch(`${API}/notifications`)
      ]);

      const buses = (await busesRes.json()).buses || [];
      const drivers = (await driversRes.json()).drivers || [];
      const passengers = (await passengersRes.json()).passengers || [];
      const passes = (await passesRes.json()).passes || [];
      const attendance = (await attendanceRes.json()).attendance || [];
      const notifications = (await notificationsRes.json()).notifications || [];

      const busList = document.getElementById('adminBusList');
      if (busList) {
        busList.innerHTML = buses.map((bus) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${bus.bus_number}</strong><br>
                <small class="text-muted">${bus.route}</small>
              </div>
              <span class="badge bg-primary">${bus.capacity} seats</span>
            </div>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No buses found</div>';
      }

      const driverList = document.getElementById('adminDriverList');
      if (driverList) {
        driverList.innerHTML = drivers.map((d) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${d.full_name}</strong><br>
                <small class="text-muted">${d.email}</small>
              </div>
              <span class="badge ${d.bus_number ? 'bg-success' : 'bg-secondary'}">${d.bus_number || 'Unassigned'}</span>
            </div>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No drivers found</div>';
      }

      const passengerList = document.getElementById('adminPassengerList');
      if (passengerList) {
        passengerList.innerHTML = passengers.map((p) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${p.full_name}</strong><br>
                <small class="text-muted">${p.email}</small>
              </div>
              <span class="badge ${p.bus_number ? 'bg-primary' : 'bg-secondary'}">${p.bus_number || 'Unassigned'}</span>
            </div>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No passengers found</div>';
      }

      const passList = document.getElementById('adminPassList');
      if (passList) {
        passList.innerHTML = passes.map((p) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${p.passenger_name}</strong><br>
                <small class="text-muted">${p.bus_number} • ${p.pass_type}</small>
              </div>
              <span class="badge ${p.status === 'active' ? 'bg-success' : 'bg-warning'}">${p.status}</span>
            </div>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No passes found</div>';
      }

      const attendanceList = document.getElementById('adminAttendanceList');
      if (attendanceList) {
        attendanceList.innerHTML = attendance.slice(0, 8).map((row) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${row.passenger_name}</strong><br>
                <small class="text-muted">${row.bus_number} • ${row.route}</small>
              </div>
              <span class="badge ${row.status === 'present' ? 'bg-success' : 'bg-danger'}">${row.status}</span>
            </div>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No attendance found</div>';
      }

      const notificationList = document.getElementById('adminNotificationList');
      if (notificationList) {
        notificationList.innerHTML = notifications.slice(0, 8).map((n) => `
          <div class="list-group-item">
            <strong>${n.title}</strong><br>
            <small class="text-muted">${n.message}</small>
          </div>
        `).join('') || '<div class="list-group-item text-muted">No notifications found</div>';
      }

      buildSelect('adminDriverAssignSelect', drivers.map((d) => ({ value: d.id, label: `${d.full_name} (${d.email})` })), 'Select driver');
      buildSelect('adminBusAssignSelect', buses.map((b) => ({ value: b.id, label: `${b.bus_number} - ${b.route}` })), 'Select bus');
      buildSelect('adminPassengerAssignSelect', passengers.map((p) => ({ value: p.id, label: `${p.full_name} (${p.email})` })), 'Select passenger');
      buildSelect('adminPassPassengerSelect', passengers.map((p) => ({ value: p.id, label: `${p.full_name}` })), 'Select passenger');
      buildSelect('adminPassBusSelect', buses.map((b) => ({ value: b.id, label: `${b.bus_number} - ${b.route}` })), 'Select bus');
      buildSelect('adminNotificationUserSelect', [{ value: 'all', label: 'All users' }, ...passengers.map((p) => ({ value: p.id, label: `${p.full_name}` })), ...drivers.map((d) => ({ value: d.id, label: `${d.full_name}` }))], 'Select recipient');
    } catch (error) {
      console.error('Admin load error:', error);
    }
  };

  const assignDriver = document.getElementById('adminAssignDriverBtn');
  if (assignDriver) {
    assignDriver.addEventListener('click', async () => {
      const driver_id = document.getElementById('adminDriverAssignSelect')?.value;
      const bus_id = document.getElementById('adminBusAssignSelect')?.value;
      if (!driver_id || !bus_id) {
        alert('Select both driver and bus');
        return;
      }
      const response = await fetch(`${API}/driver-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id, bus_id })
      });
      const result = await response.json();
      alert(result.message || 'Assignment saved');
      loadData();
    });
  }

  const assignPassenger = document.getElementById('adminAssignPassengerBtn');
  if (assignPassenger) {
    assignPassenger.addEventListener('click', async () => {
      const passenger_id = document.getElementById('adminPassengerAssignSelect')?.value;
      const bus_id = document.getElementById('adminBusAssignSelect')?.value;
      if (!passenger_id || !bus_id) {
        alert('Select both passenger and bus');
        return;
      }
      const response = await fetch(`${API}/passenger-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passenger_id, bus_id })
      });
      const result = await response.json();
      alert(result.message || 'Assignment saved');
      loadData();
    });
  }

  const createPass = document.getElementById('adminCreatePassBtn');
  if (createPass) {
    createPass.addEventListener('click', async () => {
      const passenger_id = document.getElementById('adminPassPassengerSelect')?.value;
      const bus_id = document.getElementById('adminPassBusSelect')?.value;
      const pass_type = document.getElementById('adminPassTypeSelect')?.value || 'monthly';
      const start_date = document.getElementById('adminPassStartDate')?.value || new Date().toISOString().slice(0, 10);
      const end_date = document.getElementById('adminPassEndDate')?.value || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      if (!passenger_id || !bus_id) {
        alert('Select passenger and bus');
        return;
      }
      const response = await fetch(`${API}/passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passenger_id, bus_id, pass_type, start_date, end_date })
      });
      const result = await response.json();
      alert(result.message || 'Pass created');
      loadData();
    });
  }

  const sendNotification = document.getElementById('adminSendNotificationBtn');
  if (sendNotification) {
    sendNotification.addEventListener('click', async () => {
      const user_id = document.getElementById('adminNotificationUserSelect')?.value;
      const title = document.getElementById('adminNotificationTitle')?.value.trim();
      const message = document.getElementById('adminNotificationMessage')?.value.trim();
      if (!title || !message) {
        alert('Enter title and message');
        return;
      }
      if (!user_id || user_id === 'all') {
        alert('Please select a specific user for notification.');
        return;
      }
      const response = await fetch(`${API}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, title, message })
      });
      const result = await response.json();
      alert(result.message || 'Notification sent');
      loadData();
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('busOneUser');
    window.location.href = 'index.html';
  });

  loadData();
});
