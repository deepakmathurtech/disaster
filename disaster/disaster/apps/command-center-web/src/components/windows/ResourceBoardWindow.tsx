import React, { useState } from 'react';

export interface ResourceUnit {
  id: string;
  callsign: string;
  type: 'MEDICAL' | 'ENGINEERING' | 'RESCUE' | 'LOGISTICS' | 'POLICE';
  status: 'AVAILABLE' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'OFFLINE';
  assignedTask?: string;
  locationName: string;
  personnelCount: number;
  equipment: string;
}

const INITIAL_UNITS: ResourceUnit[] = [
  { id: 'u1', callsign: 'Unit-17 (Alpha Eng)', type: 'ENGINEERING', status: 'ON_SCENE', assignedTask: 'Bridge B12 Inspection', locationName: 'Old Yamuna Bridge', personnelCount: 12, equipment: 'Heavy Winch, Structural Sensors' },
  { id: 'u2', callsign: 'Unit-04 (Bravo Relief)', type: 'LOGISTICS', status: 'DISPATCHED', assignedTask: 'Shelter Alpha Supplies', locationName: 'Relief Camp Alpha', personnelCount: 8, equipment: '2x 5-Ton Trucks, Rations' },
  { id: 'u3', callsign: 'NDRF Battalion 8', type: 'RESCUE', status: 'AVAILABLE', locationName: 'ISBT Staging Area', personnelCount: 35, equipment: '6x Inflatable Motorboats, Scuba' },
  { id: 'u4', callsign: 'Trauma Medic Unit 02', type: 'MEDICAL', status: 'AVAILABLE', locationName: 'LNJP Emergency Dock', personnelCount: 6, equipment: '2x ALS Ambulances, Triage Kits' },
  { id: 'u5', callsign: 'Delhi Police Sector 4', type: 'POLICE', status: 'ON_SCENE', assignedTask: 'Ring Road Diversions', locationName: 'Kashmere Gate Chowk', personnelCount: 20, equipment: 'Traffic Barricades, Megaphones' },
];

interface ResourceBoardProps {
  onDispatchUnit: (unitId: string, taskTitle: string) => void;
}

export default function ResourceBoardWindow({ onDispatchUnit }: ResourceBoardProps) {
  const [units, setUnits] = useState<ResourceUnit[]>(INITIAL_UNITS);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('u3');
  const [taskInput, setTaskInput] = useState<string>('');

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim() || !selectedUnitId) return;

    setUnits(prev =>
      prev.map(u => (u.id === selectedUnitId ? { ...u, status: 'DISPATCHED', assignedTask: taskInput } : u))
    );
    onDispatchUnit(selectedUnitId, taskInput);
    setTaskInput('');
  };

  const selectedUnit = units.find(u => u.id === selectedUnitId);

  return (
    <div className="fw-body-inner flex-col" style={{ gap: '10px' }}>
      {/* Overview Cards */}
      <div className="resource-stat-bar">
        <div className="res-stat-card">
          <span className="res-stat-val">{units.filter(u => u.status === 'AVAILABLE').length}</span>
          <span className="res-stat-lbl">AVAILABLE</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-val" style={{ color: 'var(--cyan)' }}>{units.filter(u => u.status === 'DISPATCHED' || u.status === 'EN_ROUTE').length}</span>
          <span className="res-stat-lbl">DISPATCHED</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-val" style={{ color: 'var(--amber)' }}>{units.filter(u => u.status === 'ON_SCENE').length}</span>
          <span className="res-stat-lbl">ON SCENE</span>
        </div>
        <div className="res-stat-card">
          <span className="res-stat-val" style={{ color: 'var(--green)' }}>{units.reduce((acc, u) => acc + u.personnelCount, 0)}</span>
          <span className="res-stat-lbl">PERSONNEL</span>
        </div>
      </div>

      {/* Unit Table */}
      <div className="resource-table-container">
        <table className="resource-table">
          <thead>
            <tr>
              <th>CALLSIGN</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>CURRENT TASK</th>
              <th>LOCATION</th>
            </tr>
          </thead>
          <tbody>
            {units.map(unit => (
              <tr
                key={unit.id}
                className={unit.id === selectedUnitId ? 'selected-row' : ''}
                onClick={() => setSelectedUnitId(unit.id)}
              >
                <td className="res-callsign">
                  {unit.type === 'MEDICAL' ? '🚑 ' : unit.type === 'RESCUE' ? '🚤 ' : unit.type === 'ENGINEERING' ? '🏗 ' : '🚓 '}
                  {unit.callsign}
                </td>
                <td><span className="res-type-pill">{unit.type}</span></td>
                <td>
                  <span className={`res-status-badge status-${unit.status.toLowerCase()}`}>
                    {unit.status}
                  </span>
                </td>
                <td className="res-task">{unit.assignedTask || '— None —'}</td>
                <td className="res-loc">{unit.locationName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dispatch Panel */}
      {selectedUnit && (
        <form onSubmit={handleAssign} className="resource-dispatch-box">
          <div className="res-dispatch-hdr">
            <span>DISPATCH: <strong>{selectedUnit.callsign}</strong> ({selectedUnit.type})</span>
            <span className="res-equip">Eq: {selectedUnit.equipment}</span>
          </div>
          <div className="res-dispatch-input-row">
            <input
              type="text"
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              placeholder={`Assign task to ${selectedUnit.callsign}... (e.g. Deploy motorboats to ISBT)`}
            />
            <button type="submit" className="btn-download-model">ASSIGN TASK</button>
          </div>
        </form>
      )}
    </div>
  );
}
