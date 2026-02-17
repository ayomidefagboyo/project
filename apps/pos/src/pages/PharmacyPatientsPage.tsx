import React, { useEffect, useMemo, useState } from 'react';
import {
  HeartPulse,
  Search,
  UserPlus,
  PlusCircle,
  RefreshCw,
  ClipboardList,
  Phone,
  Calendar,
  UserRound,
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import {
  posService,
  type PharmacyPatient,
  type PharmacyPatientCreateRequest,
  type PatientVital,
  type PatientVitalCreateRequest,
} from '@/lib/posService';
import { useToast } from '@/components/ui/Toast';

interface PatientFormState {
  full_name: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | 'unspecified';
  date_of_birth: string;
  allergies: string;
  chronic_conditions: string;
  current_medications: string;
  notes: string;
}

interface VitalFormState {
  systolic_bp: string;
  diastolic_bp: string;
  pulse_bpm: string;
  temperature_c: string;
  respiratory_rate: string;
  oxygen_saturation: string;
  blood_glucose_mmol: string;
  weight_kg: string;
  height_cm: string;
  notes: string;
}

const initialPatientForm: PatientFormState = {
  full_name: '',
  phone: '',
  gender: 'unspecified',
  date_of_birth: '',
  allergies: '',
  chronic_conditions: '',
  current_medications: '',
  notes: '',
};

const initialVitalForm: VitalFormState = {
  systolic_bp: '',
  diastolic_bp: '',
  pulse_bpm: '',
  temperature_c: '',
  respiratory_rate: '',
  oxygen_saturation: '',
  blood_glucose_mmol: '',
  weight_kg: '',
  height_cm: '',
  notes: '',
};

const formatDateTime = (value?: string): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const computeAge = (dob?: string): string => {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 'N/A';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age} yrs` : 'N/A';
};

const toOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return undefined;
  return numeric;
};

const PharmacyPatientsPage: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { success, error } = useToast();

  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PharmacyPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PharmacyPatient | null>(null);
  const [vitals, setVitals] = useState<PatientVital[]>([]);

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingPatientDetails, setLoadingPatientDetails] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);

  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [patientForm, setPatientForm] = useState<PatientFormState>(initialPatientForm);
  const [vitalForm, setVitalForm] = useState<VitalFormState>(initialVitalForm);

  const selectedPatientFromList = useMemo(
    () => patients.find((item) => item.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const loadPatients = async (queryOverride?: string) => {
    if (!currentOutlet?.id) return;

    try {
      setLoadingPatients(true);
      const result = await posService.getPharmacyPatients(currentOutlet.id, {
        page: 1,
        size: 200,
        search: queryOverride ?? search,
      });
      setPatients(result.items || []);

      if (!selectedPatientId && result.items.length > 0) {
        setSelectedPatientId(result.items[0].id);
      }

      if (selectedPatientId && !result.items.some((item) => item.id === selectedPatientId)) {
        setSelectedPatientId(result.items[0]?.id || null);
      }
    } catch (err: any) {
      error(err?.message || 'Failed to load pharmacy patients');
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadPatientDetails = async (patientId: string) => {
    try {
      setLoadingPatientDetails(true);
      const [patient, vitalsResult] = await Promise.all([
        posService.getPharmacyPatient(patientId),
        posService.getPharmacyPatientVitals(patientId, { page: 1, size: 100 }),
      ]);
      setSelectedPatient(patient);
      setVitals(vitalsResult.items || []);
    } catch (err: any) {
      error(err?.message || 'Failed to load patient details');
    } finally {
      setLoadingPatientDetails(false);
    }
  };

  useEffect(() => {
    loadPatients('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOutlet?.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadPatients(search);
    }, 260);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      setVitals([]);
      return;
    }
    loadPatientDetails(selectedPatientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  const handleCreatePatient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentOutlet?.id) {
      error('No outlet selected');
      return;
    }
    if (!patientForm.full_name.trim()) {
      error('Patient name is required');
      return;
    }

    const payload: PharmacyPatientCreateRequest = {
      outlet_id: currentOutlet.id,
      full_name: patientForm.full_name.trim(),
      phone: patientForm.phone.trim() || undefined,
      gender: patientForm.gender,
      date_of_birth: patientForm.date_of_birth || undefined,
      allergies: patientForm.allergies.trim() || undefined,
      chronic_conditions: patientForm.chronic_conditions.trim() || undefined,
      current_medications: patientForm.current_medications.trim() || undefined,
      notes: patientForm.notes.trim() || undefined,
    };

    try {
      setCreatingPatient(true);
      const created = await posService.createPharmacyPatient(payload);
      success('Patient profile created');
      setPatientForm(initialPatientForm);
      setShowCreatePatient(false);
      await loadPatients(search);
      setSelectedPatientId(created.id);
    } catch (err: any) {
      error(err?.message || 'Failed to create patient profile');
    } finally {
      setCreatingPatient(false);
    }
  };

  const hasVitalInput = useMemo(() => {
    return Object.entries(vitalForm).some(([key, value]) => key !== 'notes' && value.trim() !== '');
  }, [vitalForm]);

  const handleSaveVitals = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPatientId) {
      error('Select a patient first');
      return;
    }
    if (!hasVitalInput && !vitalForm.notes.trim()) {
      error('Enter at least one vital value or a clinical note');
      return;
    }

    const payload: PatientVitalCreateRequest = {
      systolic_bp: toOptionalNumber(vitalForm.systolic_bp),
      diastolic_bp: toOptionalNumber(vitalForm.diastolic_bp),
      pulse_bpm: toOptionalNumber(vitalForm.pulse_bpm),
      temperature_c: toOptionalNumber(vitalForm.temperature_c),
      respiratory_rate: toOptionalNumber(vitalForm.respiratory_rate),
      oxygen_saturation: toOptionalNumber(vitalForm.oxygen_saturation),
      blood_glucose_mmol: toOptionalNumber(vitalForm.blood_glucose_mmol),
      weight_kg: toOptionalNumber(vitalForm.weight_kg),
      height_cm: toOptionalNumber(vitalForm.height_cm),
      notes: vitalForm.notes.trim() || undefined,
    };

    try {
      setSavingVitals(true);
      await posService.createPharmacyPatientVital(selectedPatientId, payload);
      success('Patient vitals recorded');
      setVitalForm(initialVitalForm);
      await loadPatientDetails(selectedPatientId);
      await loadPatients(search);
    } catch (err: any) {
      error(err?.message || 'Failed to save patient vitals');
    } finally {
      setSavingVitals(false);
    }
  };

  const patientCard = selectedPatient || selectedPatientFromList;

  return (
    <div className="h-full min-h-0 overflow-hidden bg-stone-50 p-3 sm:p-4 lg:p-5">
      <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-3 sm:gap-4">
        <section className="bg-white border border-stone-200 rounded-2xl flex flex-col min-h-0">
          <div className="p-3 sm:p-4 border-b border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <HeartPulse className="w-5 h-5" />
                Patients
              </h2>
              <button
                type="button"
                onClick={() => setShowCreatePatient((prev) => !prev)}
                className="btn-brand text-white px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patient name/code/phone"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

            {showCreatePatient && (
              <form onSubmit={handleCreatePatient} className="space-y-2 rounded-xl border border-stone-200 p-3 bg-stone-50">
                <input
                  value={patientForm.full_name}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, full_name: event.target.value }))}
                  placeholder="Patient full name"
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <input
                  value={patientForm.phone}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Phone"
                  className="w-full h-10 px-3 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={patientForm.gender}
                    onChange={(event) => setPatientForm((prev) => ({ ...prev, gender: event.target.value as PatientFormState['gender'] }))}
                    className="h-10 px-3 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  >
                    <option value="unspecified">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="date"
                    value={patientForm.date_of_birth}
                    onChange={(event) => setPatientForm((prev) => ({ ...prev, date_of_birth: event.target.value }))}
                    className="h-10 px-3 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                </div>
                <textarea
                  value={patientForm.allergies}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, allergies: event.target.value }))}
                  placeholder="Allergies"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <textarea
                  value={patientForm.chronic_conditions}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, chronic_conditions: event.target.value }))}
                  placeholder="Chronic conditions"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <textarea
                  value={patientForm.current_medications}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, current_medications: event.target.value }))}
                  placeholder="Current medications"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <textarea
                  value={patientForm.notes}
                  onChange={(event) => setPatientForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Notes"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creatingPatient}
                    className="btn-brand text-white h-10 px-3 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {creatingPatient ? 'Saving...' : 'Save Patient'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreatePatient(false);
                      setPatientForm(initialPatientForm);
                    }}
                    className="h-10 px-3 rounded-lg text-sm font-semibold border border-stone-300 text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {loadingPatients ? (
              <div className="h-full flex items-center justify-center text-sm text-stone-500">Loading patients...</div>
            ) : patients.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-stone-500 text-center px-4">
                No patient records yet for this outlet.
              </div>
            ) : (
              <div className="space-y-2">
                {patients.map((patient) => {
                  const selected = patient.id === selectedPatientId;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm sm:text-base truncate">{patient.full_name}</p>
                        <span className={`text-xs font-semibold ${selected ? 'text-stone-200' : 'text-stone-500'}`}>
                          {patient.patient_code}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${selected ? 'text-stone-200' : 'text-stone-500'}`}>
                        {patient.phone || 'No phone'}
                      </p>
                      <p className={`text-xs mt-1 ${selected ? 'text-stone-200' : 'text-stone-500'}`}>
                        Last visit: {formatDateTime(patient.last_visit_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-stone-200 rounded-2xl min-h-0 overflow-hidden flex flex-col">
          {!patientCard ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-500 px-6 text-center">
              <ClipboardList className="w-10 h-10 mb-3" />
              <p className="text-base font-semibold">Select a patient to capture vitals</p>
            </div>
          ) : (
            <>
              <div className="border-b border-stone-200 p-3 sm:p-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{patientCard.full_name}</h3>
                  <p className="text-sm text-stone-500 font-semibold">{patientCard.patient_code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => selectedPatientId && loadPatientDetails(selectedPatientId)}
                  className="h-10 px-3 rounded-lg border border-stone-300 text-sm font-semibold text-slate-700 inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPatientDetails ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Age</div>
                    <div className="text-lg font-bold text-slate-900 mt-1">{computeAge(patientCard.date_of_birth)}</div>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> Contact
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1 truncate">{patientCard.phone || 'N/A'}</div>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Last Visit
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">{formatDateTime(patientCard.last_visit_at)}</div>
                  </div>
                </div>

                {(patientCard.allergies || patientCard.chronic_conditions || patientCard.current_medications || patientCard.notes) && (
                  <div className="rounded-xl border border-stone-200 p-3 bg-white">
                    <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-1">
                      <UserRound className="w-4 h-4" /> Clinical Profile
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-stone-500">Allergies</p>
                        <p className="text-slate-900 whitespace-pre-wrap">{patientCard.allergies || 'None recorded'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-stone-500">Chronic Conditions</p>
                        <p className="text-slate-900 whitespace-pre-wrap">{patientCard.chronic_conditions || 'None recorded'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-stone-500">Current Medications</p>
                        <p className="text-slate-900 whitespace-pre-wrap">{patientCard.current_medications || 'None recorded'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-stone-500">Notes</p>
                        <p className="text-slate-900 whitespace-pre-wrap">{patientCard.notes || 'No notes'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveVitals} className="rounded-xl border border-stone-200 p-3 sm:p-4 bg-stone-50 space-y-3">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Record Vitals
                  </h4>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <input
                      value={vitalForm.systolic_bp}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, systolic_bp: event.target.value }))}
                      placeholder="SYS BP"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.diastolic_bp}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, diastolic_bp: event.target.value }))}
                      placeholder="DIA BP"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.pulse_bpm}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, pulse_bpm: event.target.value }))}
                      placeholder="Pulse"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.temperature_c}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, temperature_c: event.target.value }))}
                      placeholder="Temp °C"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.respiratory_rate}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, respiratory_rate: event.target.value }))}
                      placeholder="Resp. Rate"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.oxygen_saturation}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, oxygen_saturation: event.target.value }))}
                      placeholder="SpO2 %"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.blood_glucose_mmol}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, blood_glucose_mmol: event.target.value }))}
                      placeholder="Glucose"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.weight_kg}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, weight_kg: event.target.value }))}
                      placeholder="Weight kg"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                    <input
                      value={vitalForm.height_cm}
                      onChange={(event) => setVitalForm((prev) => ({ ...prev, height_cm: event.target.value }))}
                      placeholder="Height cm"
                      className="h-11 px-3 rounded-lg border border-stone-300 text-sm font-semibold"
                    />
                  </div>

                  <textarea
                    value={vitalForm.notes}
                    onChange={(event) => setVitalForm((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={2}
                    placeholder="Clinical observation notes"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium"
                  />

                  <button
                    type="submit"
                    disabled={savingVitals}
                    className="btn-brand text-white h-11 px-4 rounded-lg text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <HeartPulse className="w-4 h-4" />
                    {savingVitals ? 'Saving...' : 'Save Vitals'}
                  </button>
                </form>

                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-200">
                    <h4 className="font-semibold text-slate-900 text-sm">Vitals History</h4>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-stone-100">
                    {loadingPatientDetails ? (
                      <div className="px-3 py-8 text-center text-sm text-stone-500">Loading vitals...</div>
                    ) : vitals.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-stone-500">No vitals recorded yet.</div>
                    ) : (
                      vitals.map((record) => (
                        <div key={record.id} className="px-3 py-2.5 text-sm">
                          <p className="font-semibold text-slate-900">{formatDateTime(record.recorded_at)}</p>
                          <p className="text-stone-600 mt-1">
                            BP {record.systolic_bp || '-'} / {record.diastolic_bp || '-'} | Pulse {record.pulse_bpm || '-'} | Temp {record.temperature_c || '-'}
                          </p>
                          <p className="text-stone-600 mt-0.5">
                            SpO2 {record.oxygen_saturation || '-'} | Glucose {record.blood_glucose_mmol || '-'} | Weight {record.weight_kg || '-'}kg
                          </p>
                          {record.notes && <p className="text-stone-700 mt-1 whitespace-pre-wrap">{record.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default PharmacyPatientsPage;
