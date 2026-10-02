(function () {
  const DEVICE_KEY = 'lumabooth_camera_device_v1';

  function getSelectedDeviceId() {
    try {
      return localStorage.getItem(DEVICE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function publishSelection(deviceId, name) {
    try {
      localStorage.setItem(DEVICE_KEY, deviceId);
    } catch (error) {}

    document.querySelectorAll('[data-camera-select]').forEach((select) => {
      if (select.value !== deviceId) select.value = deviceId;
    });

    document.querySelectorAll('[data-camera-name]').forEach((label) => {
      label.textContent = name;
    });

    window.dispatchEvent(new CustomEvent('lumabooth-camera-change', {
      detail: { deviceId, name }
    }));
  }

  async function refreshCameraSelectors() {
    const selectors = Array.from(document.querySelectorAll('[data-camera-select]'));
    if (!selectors.length) return;

    if (!navigator.mediaDevices?.enumerateDevices) {
      selectors.forEach((select) => {
        select.innerHTML = '<option value="">Camera access unavailable</option>';
        select.disabled = true;
      });
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === 'videoinput');
      const savedId = getSelectedDeviceId();
      const activeCamera = cameras.find((camera) => camera.deviceId === savedId) || cameras[0];

      selectors.forEach((select) => {
        select.replaceChildren();
        if (!cameras.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No cameras found';
          select.appendChild(option);
          select.disabled = true;
          return;
        }

        cameras.forEach((camera, index) => {
          const option = document.createElement('option');
          option.value = camera.deviceId;
          option.textContent = camera.label || `Camera ${index + 1}`;
          select.appendChild(option);
        });
        select.disabled = false;
        select.value = activeCamera.deviceId;
      });

      if (activeCamera) {
        const name = activeCamera.label || `Camera ${cameras.indexOf(activeCamera) + 1}`;
        document.querySelectorAll('[data-camera-name]').forEach((label) => {
          label.textContent = name;
        });
        if (activeCamera.deviceId !== savedId) {
          try {
            localStorage.setItem(DEVICE_KEY, activeCamera.deviceId);
          } catch (error) {}
        }
      }
    } catch (error) {
      selectors.forEach((select) => {
        select.innerHTML = '<option value="">Unable to list cameras</option>';
        select.disabled = true;
      });
    }
  }

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-camera-select]');
    if (!select || !select.value) return;
    publishSelection(select.value, select.selectedOptions[0]?.textContent || 'Camera');
  });

  window.LumaBoothCamera = { getSelectedDeviceId, refreshCameraSelectors };
  document.addEventListener('DOMContentLoaded', refreshCameraSelectors);
})();