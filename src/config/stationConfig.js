export const STATION_CONFIG = {
    PC_A: {
        id: 'PC_A',
        name: 'PC A (원장실/치료실)',
        roles: {
            left: { id: 'Doctor', name: '원장님', color: 'blue' },
            right: { id: 'Nurse', name: '치료실', color: 'green' }
        }
    },
    PC_B: {
        id: 'PC_B',
        name: 'PC B (실장/탕전실)',
        roles: {
            left: { id: 'Manager', name: '실장님', color: 'purple' },
            right: { id: 'Pharmacy', name: '탕전실', color: 'orange' }
        }
    }
};

export const getStationConfig = () => {
    const stationId = localStorage.getItem('STATION_ID') || 'PC_A';
    return STATION_CONFIG[stationId];
};

export const setStationId = (id) => {
    if (STATION_CONFIG[id]) {
        localStorage.setItem('STATION_ID', id);
        window.location.reload(); // Reload to apply changes
    }
};
