const supportLabels = {
  ar_ambiente: "Ar ambiente",
  cateter_nasal: "Cateter nasal",
  venturi: "Mascara de Venturi",
  alto_fluxo: "Alto fluxo",
  macronebulizacao: "Macronebulizacao",
  vni: "VNI",
  vmi: "Ventilacao mecanica invasiva",
  traqueostomia: "Traqueostomia"
};

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateOnly(value) {
  return toIsoString(value)?.slice(0, 10) ?? "";
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSupportType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases = {
    "ar ambiente": "ar_ambiente",
    ar_ambiente: "ar_ambiente",
    "cateter nasal": "cateter_nasal",
    cateter_nasal: "cateter_nasal",
    "mascara de venturi": "venturi",
    venturi: "venturi",
    "alto fluxo": "alto_fluxo",
    alto_fluxo: "alto_fluxo",
    hfnc: "alto_fluxo",
    macronebulizacao: "macronebulizacao",
    vni: "vni",
    vmi: "vmi",
    "ventilacao mecanica invasiva": "vmi",
    traqueostomia: "traqueostomia"
  };

  return aliases[normalized] ?? normalized;
}

function formatSupportSummary(support) {
  const label = support.label || supportLabels[support.type] || "Nao informado";

  if (support.type === "cateter_nasal" && support.flowRate != null) {
    return `${label} ${support.flowRate} L/min`;
  }

  if (["venturi", "alto_fluxo"].includes(support.type)) {
    const values = [
      support.flowRate != null ? `${support.flowRate} L/min` : null,
      support.fio2 != null ? `FiO2 ${support.fio2}%` : null
    ].filter(Boolean);
    return values.length ? `${label} - ${values.join(" - ")}` : label;
  }

  if (support.type === "vni") {
    const values = [
      support.mode,
      support.ipap != null ? `IPAP ${support.ipap}` : null,
      support.epap != null ? `EPAP ${support.epap}` : null,
      support.fio2 != null ? `FiO2 ${support.fio2}%` : null
    ].filter(Boolean);
    return values.length ? `${label} - ${values.join(" - ")}` : label;
  }

  if (support.type === "vmi") {
    const values = [
      support.mode,
      support.peep != null ? `PEEP ${support.peep}` : null,
      support.fio2 != null ? `FiO2 ${support.fio2}%` : null
    ].filter(Boolean);
    return values.length ? `${label} - ${values.join(" - ")}` : label;
  }

  return label;
}

function mapVentilatorySupport(value) {
  const source = typeof value === "string" ? { type: value } : asObject(value);
  const type = normalizeSupportType(source.type);
  const support = {
    type,
    label: source.label || supportLabels[type] || "Nao informado",
    flowRate: source.flowRate ?? null,
    fio2: source.fio2 ?? null,
    temperature: source.temperature ?? null,
    mode: source.mode ?? "",
    ipap: source.ipap ?? null,
    epap: source.epap ?? null,
    peep: source.peep ?? null,
    tidalVolume: source.tidalVolume ?? null,
    respiratoryRate: source.respiratoryRate ?? null,
    pressureSupport: source.pressureSupport ?? null,
    solution: source.solution ?? "",
    targetSaturation: source.targetSaturation ?? null,
    summary: source.summary ?? ""
  };

  return {
    ...support,
    summary: support.summary || formatSupportSummary(support)
  };
}

function addDays(value, days) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + days);
  return date;
}

function buildFilterTracking(lastChangeDateTime) {
  const lastChange = toIsoString(lastChangeDateTime);

  if (!lastChange) {
    return {
      lastChangeDateTime: null,
      nextChangeDateTime: null,
      status: "nao_aplicavel",
      label: "Sem registro",
      hoursUntilNextChange: null,
      isOverdue: false,
      isPreventive: false
    };
  }

  const nextChange = addDays(lastChange, 3);
  const hoursUntilNextChange = nextChange ? Math.round((nextChange.getTime() - Date.now()) / 36e5) : null;
  const isOverdue = hoursUntilNextChange != null && hoursUntilNextChange < 0;
  const isPreventive = hoursUntilNextChange != null && hoursUntilNextChange >= 0 && hoursUntilNextChange <= 12;

  return {
    lastChangeDateTime: lastChange,
    nextChangeDateTime: nextChange?.toISOString() ?? null,
    status: isOverdue ? "vencido" : isPreventive ? "preventivo" : "em_dia",
    label: isOverdue ? "Filtro vencido" : isPreventive ? "Troca preventiva" : "Em dia",
    hoursUntilNextChange,
    isOverdue,
    isPreventive
  };
}

function mapLabs(labs) {
  return asArray(labs).map((lab) => ({
    id: lab.id,
    date: toDateOnly(lab.date),
    hb: lab.hb ?? "",
    ht: lab.ht ?? "",
    leuco: lab.leuco ?? "",
    bt: lab.bt ?? "",
    plq: lab.plq ?? "",
    ur: lab.ur ?? "",
    cr: lab.cr ?? "",
    pcr: lab.pcr ?? "",
    na: lab.na ?? "",
    k: lab.k ?? "",
    ca: lab.ca ?? "",
    ac: lab.lactate ?? "",
    extraExamName: lab.extraExamName ?? "",
    extraExamValue: lab.extraExamValue ?? ""
  }));
}

function mapImaging(imaging) {
  return asArray(imaging).map((exam) => ({
    date: toDateOnly(exam.date),
    type: exam.type ?? "",
    result: exam.result ?? exam.report ?? ""
  }));
}

function mapEvolutions(evolutions) {
  return asArray(evolutions).map((evolution) => ({
    date: toDateOnly(evolution.date),
    type: evolution.type ?? "",
    professional: evolution.professionalName ?? "Nao informado",
    note: evolution.description ?? ""
  }));
}

export function mapPatientRecord(patient) {
  const clinicalHistory = asObject(patient.clinicalHistory);
  const admissionMetrics = patient.admissionMetrics ?? {};
  const currentBed = asArray(patient.beds).find((bed) => bed.occupied) ?? asArray(patient.beds)[0] ?? null;
  const filterChanges = asObject(patient.filterChanges);
  const ventilatoryFilterSource =
    asObject(filterChanges.ventilatoryFilter).lastChangeDateTime ?? admissionMetrics.lastFilterChangeDate ?? null;
  const trachCareSource = asObject(filterChanges.trachCare).lastChangeDateTime ?? null;
  const ventilatoryFilter = buildFilterTracking(ventilatoryFilterSource);
  const trachCare = buildFilterTracking(trachCareSource);
  const discharge = asObject(clinicalHistory.discharge);
  const hasDischarge = Boolean(discharge.type);
  const alerts = asArray(patient.alerts).map((alert) => alert.description).filter(Boolean);

  return {
    id: patient.id,
    organizationId: patient.organizationId,
    name: patient.name,
    recordNumber: patient.recordNumber,
    age: patient.age,
    diagnosis: patient.diagnosis,
    origin: patient.origin ?? null,
    internalTransferLocation: patient.internalTransferLocation ?? null,
    bedId: currentBed?.id ?? null,
    bedCode: currentBed?.code ?? null,
    lastBedId: clinicalHistory.lastBedId ?? currentBed?.id ?? null,
    lastBedCode: clinicalHistory.lastBedCode ?? currentBed?.code ?? null,
    admissionDate: toDateOnly(patient.admissionDate),
    ventilatorySupport: mapVentilatorySupport(patient.ventilatorySupport),
    mobilityLevel: patient.mobilityLevel ?? "Nao informado",
    reasonForAdmission: patient.reasonForAdmission ?? patient.diagnosis,
    clinicalHistory: {
      antecedentes: asArray(clinicalHistory.antecedentes),
      comorbidities: asArray(clinicalHistory.comorbidities),
      intercurrences: asArray(clinicalHistory.intercurrences),
      clinicalAlerts: asArray(clinicalHistory.clinicalAlerts)
    },
    mechanicalVentilation: patient.mechanicalVentilation ? asObject(patient.mechanicalVentilation) : null,
    ventilatorParameters: {
      mode: "",
      fio2: "",
      peep: "",
      pressureSupport: "",
      tidalVolume: "",
      respiratoryRate: "",
      targetSaturation: "",
      ...asObject(patient.ventilatorParameters)
    },
    restrictions: {
      motor: [],
      respiratory: [],
      mobilization: [],
      isolation: "Nao",
      contraindications: [],
      ...asObject(patient.restrictions)
    },
    physiotherapyPlan: {
      respiratoryEvolution: "Nao informado",
      motorEvolution: "Nao informado",
      conducts: [],
      patientResponse: "Nao informado",
      ...asObject(patient.physiotherapyPlan)
    },
    clinicalNotes: patient.clinicalNotes ?? "",
    clinicalUpdatedAt: toIsoString(patient.clinicalUpdatedAt),
    clinicalUpdatedBy: patient.clinicalUpdatedBy ?? "",
    filterChanges: {
      ventilatoryFilter,
      trachCare
    },
    complementaryExams: {
      bloodGas: [],
      tomography: [],
      other: [],
      ...asObject(patient.complementaryExams)
    },
    discharge: hasDischarge
      ? {
          type: discharge.type,
          dateTime: discharge.dateTime ?? "",
          note: discharge.note ?? "",
          destination: discharge.destination ?? null
        }
      : null,
    stayMetrics: {
      hospitalDays: admissionMetrics.daysInHospital ?? null,
      ctiDays: admissionMetrics.daysInICU ?? null,
      mechanicalVentilationDays: admissionMetrics.daysOnVM ?? null,
      iotDays: admissionMetrics.daysOnIOT ?? null,
      tqtDays: admissionMetrics.daysOnTQT ?? null,
      extubationHours: admissionMetrics.extubationTime ?? null,
      extubationDays:
        admissionMetrics.extubationTime == null ? null : Math.ceil(Number(admissionMetrics.extubationTime) / 24)
    },
    filterStatus: {
      lastFilterChangeDateTime: ventilatoryFilter.lastChangeDateTime,
      nextFilterChangeDateTime: ventilatoryFilter.nextChangeDateTime,
      status: ventilatoryFilter.status,
      label: ventilatoryFilter.label,
      hoursUntilNextChange: ventilatoryFilter.hoursUntilNextChange,
      isOverdue: ventilatoryFilter.isOverdue,
      isPreventive: ventilatoryFilter.isPreventive
    },
    respiratoryAlerts: ventilatoryFilter.isOverdue ? ["Filtro ventilatorio vencido", ...alerts] : alerts,
    alerts,
    labs: mapLabs(patient.labs),
    bloodGas: asArray(asObject(patient.complementaryExams).bloodGas),
    imaging: mapImaging(patient.imaging),
    evolutions: mapEvolutions(patient.evolutions)
  };
}

export function mapBedRecord(bed) {
  const patient = bed.patient ? mapPatientRecord(bed.patient) : null;

  return {
    id: bed.id,
    organizationId: bed.organizationId,
    sectorId: bed.sectorId ?? null,
    code: bed.code,
    sector: bed.sector?.name ?? bed.sectorName,
    occupied: bed.occupied,
    status: bed.status,
    isActive: bed.isActive,
    patientId: bed.patientId,
    alertCount: patient?.alerts?.length ?? 0,
    patient
  };
}
