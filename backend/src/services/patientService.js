import { prisma } from "../middleware/prismaMiddleware.js";
import { mapPatientRecord } from "../utils/patientMapper.js";
import { activeBedWhere, activePatientWhere } from "./sectorAccessService.js";

function activeOrganizationBedWhere(organizationId) {
  return {
    organizationId,
    occupied: true,
    isActive: true,
    OR: [{ sectorId: null }, { sector: { isActive: true } }]
  };
}

function getPatientInclude(organizationId, sectorIds = null) {
  return {
    beds: {
      where: sectorIds ? { ...activeBedWhere(organizationId, sectorIds), occupied: true } : activeOrganizationBedWhere(organizationId),
      take: 1,
      orderBy: { id: "asc" }
    },
    admissionMetrics: true,
    labs: { orderBy: { date: "desc" } },
    imaging: { orderBy: { date: "desc" } },
    evolutions: { orderBy: { date: "desc" } },
    alerts: { where: { isActive: true } }
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDefined(existingValue, incomingValue) {
  if (incomingValue === undefined) {
    return existingValue;
  }

  if (Array.isArray(incomingValue)) {
    return incomingValue;
  }

  if (isPlainObject(existingValue) || isPlainObject(incomingValue)) {
    const base = isPlainObject(existingValue) ? existingValue : {};
    const incoming = isPlainObject(incomingValue) ? incomingValue : {};
    const merged = { ...base };

    for (const key of Object.keys(incoming)) {
      merged[key] = mergeDefined(base[key], incoming[key]);
    }

    return merged;
  }

  return incomingValue;
}

function cleanJson(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSupportType(value) {
  const normalized = normalizeString(value).toLowerCase();
  const aliases = {
    "ar ambiente": "ar_ambiente",
    ar_ambiente: "ar_ambiente",
    "cateter nasal": "cateter_nasal",
    cateter_nasal: "cateter_nasal",
    "máscara de venturi": "venturi",
    "mascara de venturi": "venturi",
    venturi: "venturi",
    "alto fluxo": "alto_fluxo",
    hfnc: "alto_fluxo",
    alto_fluxo: "alto_fluxo",
    "macronebulização": "macronebulizacao",
    macronebulizacao: "macronebulizacao",
    vni: "vni",
    "ventilação mecânica invasiva": "vmi",
    "ventilacao mecanica invasiva": "vmi",
    vmi: "vmi",
    traqueostomia: "traqueostomia"
  };

  return aliases[normalized] ?? normalized;
}

function normalizeVentilatorySupport(value) {
  if (!value) {
    return null;
  }

  const source = typeof value === "string" ? { type: value } : value;
  const type = normalizeSupportType(source?.type);

  if (!type) {
    return null;
  }

  const support = {
    type,
    flowRate: normalizeNumber(source?.flowRate),
    fio2: normalizeNumber(source?.fio2),
    temperature: normalizeNumber(source?.temperature),
    mode: normalizeString(source?.mode) || null,
    ipap: normalizeNumber(source?.ipap),
    epap: normalizeNumber(source?.epap),
    peep: normalizeNumber(source?.peep),
    tidalVolume: normalizeNumber(source?.tidalVolume),
    respiratoryRate: normalizeNumber(source?.respiratoryRate),
    pressureSupport: normalizeNumber(source?.pressureSupport),
    solution: normalizeString(source?.solution) || null,
    targetSaturation: normalizeNumber(source?.targetSaturation)
  };

  if (type === "cateter_nasal" && support.flowRate == null) {
    throw new Error("Informe a litragem em L/min para cateter nasal.");
  }

  if (type === "venturi" && (support.flowRate == null || support.fio2 == null)) {
    throw new Error("Informe fluxo e FiO2 para mascara de Venturi.");
  }

  if (type === "alto_fluxo" && (support.flowRate == null || support.fio2 == null)) {
    throw new Error("Informe fluxo e FiO2 para alto fluxo.");
  }

  if (type === "macronebulizacao" && support.flowRate == null) {
    throw new Error("Informe o fluxo em L/min para macronebulizacao.");
  }

  if (type === "vni" && (!support.mode || support.ipap == null || support.epap == null || support.fio2 == null)) {
    throw new Error("Informe modo, IPAP, EPAP e FiO2 para VNI.");
  }

  if (
    type === "vmi" &&
    (!support.mode ||
      support.tidalVolume == null ||
      support.respiratoryRate == null ||
      support.peep == null ||
      support.fio2 == null ||
      support.pressureSupport == null)
  ) {
    throw new Error("Informe modo, VC, FR, PEEP, FiO2 e pressao suporte para ventilacao mecanica invasiva.");
  }

  return support;
}

function getBedStatusFromSupport(ventilatorySupport) {
  return ventilatorySupport?.type === "vmi" || ventilatorySupport?.type === "vni" ? "Atencao" : "Estavel";
}

function normalizeLabs(labs) {
  if (!Array.isArray(labs)) {
    return [];
  }

  return labs.map((lab) => ({
    date: new Date(lab?.date ?? new Date()),
    hb: normalizeString(lab?.hb) || null,
    ht: normalizeString(lab?.ht) || null,
    leuco: normalizeString(lab?.leuco) || null,
    bt: normalizeString(lab?.bt) || null,
    plq: normalizeString(lab?.plq) || null,
    ur: normalizeString(lab?.ur) || null,
    cr: normalizeString(lab?.cr) || null,
    pcr: normalizeString(lab?.pcr) || null,
    na: normalizeString(lab?.na) || null,
    k: normalizeString(lab?.k) || null,
    ca: normalizeString(lab?.ca) || null,
    lactate: normalizeString(lab?.ac ?? lab?.lactate) || null,
    extraExamName: normalizeString(lab?.extraExamName) || null,
    extraExamValue: normalizeString(lab?.extraExamValue) || null
  }));
}

function normalizeImaging(imaging) {
  if (!Array.isArray(imaging)) {
    return [];
  }

  return imaging
    .filter((exam) => {
      const rawDate = normalizeString(exam?.date);

      if (!rawDate) {
        return false;
      }

      return !Number.isNaN(new Date(rawDate).getTime());
    })
    .map((exam) => ({
      date: new Date(exam.date),
      type: normalizeString(exam?.type) || "Nao informado",
      report: normalizeString(exam?.result ?? exam?.report)
    }));
}

function normalizeComplementaryExams(value) {
  if (!isPlainObject(value)) {
    return {
      bloodGas: [],
      tomography: [],
      other: []
    };
  }

  return {
    bloodGas: Array.isArray(value.bloodGas)
      ? value.bloodGas.map((item) => ({
          date: normalizeString(item?.date),
          ph: normalizeString(item?.ph),
          pao2: normalizeString(item?.pao2),
          paco2: normalizeString(item?.paco2),
          hco3: normalizeString(item?.hco3)
        }))
      : [],
    tomography: Array.isArray(value.tomography)
      ? value.tomography.map((item) => ({
          date: normalizeString(item?.date),
          type: normalizeString(item?.type),
          result: normalizeString(item?.result)
        }))
      : [],
    other: Array.isArray(value.other)
      ? value.other.map((item) => ({
          date: normalizeString(item?.date),
          type: normalizeString(item?.type),
          result: normalizeString(item?.result)
        }))
      : []
  };
}

function normalizeFilterChanges(payload, existingFilterChanges = {}) {
  const ventilatoryLast =
    payload?.filterChanges?.ventilatoryFilter?.lastChangeDateTime ??
    payload?.filterStatus?.lastFilterChangeDateTime ??
    undefined;
  const trachCareLast =
    payload?.filterChanges?.trachCare?.lastChangeDateTime ??
    payload?.filterStatus?.trachCare?.lastChangeDateTime ??
    undefined;

  return mergeDefined(existingFilterChanges, {
    ventilatoryFilter: ventilatoryLast !== undefined ? { lastChangeDateTime: ventilatoryLast || null } : undefined,
    trachCare: trachCareLast !== undefined ? { lastChangeDateTime: trachCareLast || null } : undefined
  });
}

function mapLabRecord(lab) {
  return {
    id: lab.id,
    date: lab.date.toISOString().slice(0, 10),
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
  };
}

export async function getPatients(organizationId, sectorIds) {
  const patients = await prisma.patient.findMany({
    where: activePatientWhere(organizationId, sectorIds),
    include: getPatientInclude(organizationId, sectorIds),
    orderBy: { admissionDate: "desc" }
  });

  return patients.map(mapPatientRecord);
}

export async function getPatientById(patientId, organizationId, sectorIds) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      ...activePatientWhere(organizationId, sectorIds)
    },
    include: getPatientInclude(organizationId, sectorIds)
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return mapPatientRecord(patient);
}

export async function createPatient(payload, organizationId, sectorIds) {
  const name = normalizeString(payload?.name);
  const recordNumber = normalizeString(payload?.recordNumber);
  const age = Number(payload?.age ?? 0);
  const diagnosis = normalizeString(payload?.diagnosis);
  const origin = normalizeString(payload?.origin).toLowerCase();
  const internalTransferLocation = normalizeString(payload?.internalTransferLocation);
  const admissionDate = new Date(payload?.admissionDate ?? new Date());
  const ventilatorySupport = normalizeVentilatorySupport(payload?.ventilatorySupport);
  const mobilityLevel = normalizeString(payload?.mobilityLevel);
  const reasonForAdmission = normalizeString(payload?.reasonForAdmission);
  const bedId = Number(payload?.bedId ?? 0);

  if (!name) {
    throw new Error("Nome do paciente nao informado.");
  }

  if (!recordNumber) {
    throw new Error("Numero de registro nao informado.");
  }

  if (!diagnosis) {
    throw new Error("Diagnostico nao informado.");
  }

  if (!origin) {
    throw new Error("Origem do paciente nao informada.");
  }

  if (!["emergencia", "transferencia_externa", "centro_cirurgico", "transferencia_interna"].includes(origin)) {
    throw new Error("Origem do paciente invalida.");
  }

  if (origin === "transferencia_interna" && !internalTransferLocation) {
    throw new Error("Informe o local da transferencia interna.");
  }

  if (!Number.isInteger(bedId) || bedId <= 0) {
    throw new Error("Leito nao informado.");
  }

  const existingPatient = await prisma.patient.findFirst({
    where: {
      organizationId,
      recordNumber
    }
  });

  if (existingPatient) {
    throw new Error("Ja existe um paciente com este numero de registro.");
  }

  const bed = await prisma.bed.findFirst({
    where: {
      id: bedId,
      ...activeBedWhere(organizationId, sectorIds)
    }
  });

  if (!bed) {
    throw new Error("Leito nao encontrado.");
  }

  if (bed.occupied) {
    throw new Error("O leito selecionado ja esta ocupado.");
  }

  const patientId = await prisma.$transaction(async (tx) => {
    const createdPatient = await tx.patient.create({
      data: {
        organizationId,
        name,
        recordNumber,
        age,
        diagnosis,
        origin,
        internalTransferLocation: origin === "transferencia_interna" ? internalTransferLocation : null,
        admissionDate,
        ventilatorySupport: cleanJson(ventilatorySupport),
        mobilityLevel: mobilityLevel || null,
        reasonForAdmission: reasonForAdmission || diagnosis,
        clinicalHistory: cleanJson(payload?.clinicalHistory || {
          antecedentes: [],
          comorbidities: [],
          intercurrences: [],
          clinicalAlerts: []
        }),
        restrictions: cleanJson(payload?.restrictions || {
          motor: [],
          respiratory: [],
          mobilization: [],
          isolation: "Nao",
          contraindications: []
        }),
        physiotherapyPlan: cleanJson(payload?.physiotherapyPlan || {
          respiratoryEvolution: "Acompanhamento respiratorio",
          motorEvolution: "Mobilizacao conforme tolerancia",
          conducts: [],
          patientResponse: "Nao informado"
        })
      }
    });

    await tx.admissionMetrics.create({
      data: {
        patientId: createdPatient.id,
        daysInHospital: 0,
        daysInICU: 0,
        daysOnVM: 0,
        daysOnIOT: 0,
        daysOnTQT: 0
      }
    });

    await tx.bed.update({
      where: { id: bedId },
      data: {
        occupied: true,
        patientId: createdPatient.id,
        status: getBedStatusFromSupport(ventilatorySupport)
      }
    });

    return createdPatient.id;
  }, {
    timeout: 15000
  });

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: getPatientInclude(organizationId, sectorIds)
  });

  if (!patient) {
    throw new Error("Paciente criado, mas nao foi possivel carregar o registro.");
  }

  return mapPatientRecord(patient);
}

export async function updatePatientClinicalData(patientId, payload, organizationId, sectorIds) {
  const numericPatientId = Number(patientId);
  const patient = await prisma.patient.findFirst({
    where: {
      id: numericPatientId,
      ...activePatientWhere(organizationId, sectorIds)
    },
    include: {
      admissionMetrics: true,
      beds: {
        where: { ...activeBedWhere(organizationId, sectorIds), occupied: true },
        take: 1
      }
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const currentMechanicalVentilation = isPlainObject(patient.mechanicalVentilation) ? patient.mechanicalVentilation : {};
  const currentVentilatorParameters = isPlainObject(patient.ventilatorParameters) ? patient.ventilatorParameters : {};
  const currentRestrictions = isPlainObject(patient.restrictions) ? patient.restrictions : {};
  const currentPhysiotherapyPlan = isPlainObject(patient.physiotherapyPlan) ? patient.physiotherapyPlan : {};
  const currentComplementaryExams = isPlainObject(patient.complementaryExams) ? patient.complementaryExams : {};
  const currentFilterChanges = isPlainObject(patient.filterChanges) ? patient.filterChanges : {};
  const normalizedSupport =
    payload?.ventilatorySupport !== undefined
      ? normalizeVentilatorySupport(payload.ventilatorySupport)
      : undefined;
  const updatedBy = normalizeString(payload?.updatedBy) || patient.clinicalUpdatedBy || "Nao informado";
  const filterChanges = normalizeFilterChanges(payload, currentFilterChanges);
  const ventilatoryLastChange = filterChanges?.ventilatoryFilter?.lastChangeDateTime ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: numericPatientId },
      data: {
        ventilatorySupport: normalizedSupport !== undefined ? cleanJson(normalizedSupport) : undefined,
        mechanicalVentilation:
          payload?.mechanicalVentilation !== undefined
            ? cleanJson(mergeDefined(currentMechanicalVentilation, payload.mechanicalVentilation))
            : undefined,
        ventilatorParameters:
          payload?.ventilatorParameters !== undefined
            ? cleanJson(mergeDefined(currentVentilatorParameters, payload.ventilatorParameters))
            : undefined,
        restrictions:
          payload?.restrictions !== undefined
            ? cleanJson(mergeDefined(currentRestrictions, {
                motor: payload.restrictions?.motor !== undefined ? normalizeStringArray(payload.restrictions.motor) : undefined,
                respiratory: payload.restrictions?.respiratory !== undefined ? normalizeStringArray(payload.restrictions.respiratory) : undefined,
                mobilization: payload.restrictions?.mobilization !== undefined ? normalizeStringArray(payload.restrictions.mobilization) : undefined,
                isolation: payload.restrictions?.isolation !== undefined ? normalizeString(payload.restrictions.isolation) : undefined,
                contraindications:
                  payload.restrictions?.contraindications !== undefined
                    ? normalizeStringArray(payload.restrictions.contraindications)
                    : undefined
              }))
            : undefined,
        physiotherapyPlan:
          payload?.conducts !== undefined
            ? cleanJson(mergeDefined(currentPhysiotherapyPlan, {
                conducts: normalizeStringArray(payload.conducts)
              }))
            : undefined,
        complementaryExams:
          payload?.complementaryExams !== undefined
            ? cleanJson(mergeDefined(currentComplementaryExams, normalizeComplementaryExams(payload.complementaryExams)))
            : undefined,
        filterChanges: cleanJson(filterChanges),
        clinicalNotes: payload?.clinicalNotes !== undefined ? String(payload.clinicalNotes ?? "") : undefined,
        clinicalUpdatedAt: new Date(),
        clinicalUpdatedBy: updatedBy
      }
    });

    if (patient.beds?.[0] && normalizedSupport !== undefined) {
      await tx.bed.update({
        where: { id: patient.beds[0].id },
        data: {
          status: getBedStatusFromSupport(normalizedSupport)
        }
      });
    }

    if (ventilatoryLastChange && patient.admissionMetrics?.id) {
      await tx.admissionMetrics.update({
        where: { patientId: numericPatientId },
        data: {
          lastFilterChangeDate: new Date(ventilatoryLastChange)
        }
      });
    }

    if (payload?.labs !== undefined) {
      await tx.lab.deleteMany({
        where: { patientId: numericPatientId }
      });

      const labs = normalizeLabs(payload.labs);
      if (labs.length > 0) {
        await tx.lab.createMany({
          data: labs.map((lab) => ({
            patientId: numericPatientId,
            ...lab
          }))
        });
      }
    }

    if (payload?.imaging !== undefined) {
      await tx.imaging.deleteMany({
        where: { patientId: numericPatientId }
      });

      const imaging = normalizeImaging(payload.imaging);
      if (imaging.length > 0) {
        await tx.imaging.createMany({
          data: imaging.map((exam) => ({
            patientId: numericPatientId,
            ...exam
          }))
        });
      }
    }
  }, {
    timeout: 15000
  });

  const updatedPatient = await prisma.patient.findUnique({
    where: { id: numericPatientId },
    include: getPatientInclude(organizationId, sectorIds)
  });

  if (!updatedPatient) {
    throw new Error("Dados clinicos salvos, mas nao foi possivel carregar o paciente.");
  }

  return mapPatientRecord(updatedPatient);
}

export async function dischargePatient(patientId, payload, organizationId, sectorIds) {
  const bed = await prisma.bed.findFirst({
    where: {
      patientId: Number(patientId),
      occupied: true,
      ...activeBedWhere(organizationId, sectorIds)
    }
  });

  if (!bed) {
    const error = new Error("Paciente nao possui leito ativo para alta/saida.");
    error.statusCode = 400;
    throw error;
  }

  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      organizationId
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const type = normalizeString(payload?.type).toLowerCase();
  const dateTime = normalizeString(payload?.dateTime) || new Date().toISOString();
  const notes = normalizeString(payload?.notes ?? payload?.note);
  const roomNumber = normalizeString(payload?.roomNumber);
  const destination = normalizeString(payload?.destination);

  if (!["casa", "quarto", "transferencia", "obito"].includes(type)) {
    throw new Error("Tipo de saida invalido.");
  }

  if (type === "quarto" && !roomNumber) {
    throw new Error("Informe o numero do quarto de destino.");
  }

  if (type === "transferencia" && !destination) {
    throw new Error("Informe o destino da transferencia.");
  }

  const currentClinicalHistory =
    patient.clinicalHistory && typeof patient.clinicalHistory === "object" ? patient.clinicalHistory : {};

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: Number(patientId) },
      data: {
        clinicalHistory: cleanJson({
          ...currentClinicalHistory,
          lastBedId: bed.id,
          lastBedCode: bed.code,
          discharge: {
            type,
            dateTime,
            note: notes,
            destination:
              type === "quarto"
                ? {
                    roomNumber
                  }
                : type === "transferencia"
                  ? {
                      destination
                  }
                  : null
          }
        })
      }
    });

    await tx.bed.update({
      where: { id: bed.id },
      data: {
        occupied: false,
        patientId: null,
        status: "Vago"
      }
    });
  }, {
    timeout: 15000
  });

  const updatedPatient = await prisma.patient.findUnique({
    where: { id: Number(patientId) },
    include: getPatientInclude(organizationId, sectorIds)
  });

  if (!updatedPatient) {
    throw new Error("Alta registrada, mas nao foi possivel carregar o paciente.");
  }

  return mapPatientRecord(updatedPatient);
}

export async function getPatientLabs(patientId, organizationId, sectorIds) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      ...activePatientWhere(organizationId, sectorIds)
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const labs = await prisma.lab.findMany({
    where: { patientId: Number(patientId) },
    orderBy: { date: "desc" }
  });

  return labs.map(mapLabRecord);
}

export async function createPatientLab(patientId, payload, organizationId, sectorIds) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      ...activePatientWhere(organizationId, sectorIds)
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const lab = await prisma.lab.create({
    data: {
      patientId: Number(patientId),
      date: new Date(payload?.date ?? new Date()),
      hb: payload?.hb || null,
      ht: payload?.ht || null,
      leuco: payload?.leuco || null,
      bt: payload?.bt || null,
      plq: payload?.plq || null,
      ur: payload?.ur || null,
      cr: payload?.cr || null,
      pcr: payload?.pcr || null,
      na: payload?.na || null,
      k: payload?.k || null,
      ca: payload?.ca || null,
      lactate: payload?.ac || payload?.lactate || null,
      extraExamName: payload?.extraExamName || null,
      extraExamValue: payload?.extraExamValue || null
    }
  });

  return mapLabRecord(lab);
}

export async function updatePatientLab(patientId, labId, payload, organizationId, sectorIds) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      ...activePatientWhere(organizationId, sectorIds)
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const lab = await prisma.lab.findFirst({
    where: {
      id: Number(labId),
      patientId: Number(patientId)
    }
  });

  if (!lab) {
    const error = new Error("Exame laboratorial nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const updatedLab = await prisma.lab.update({
    where: { id: Number(labId) },
    data: {
      date: new Date(payload?.date ?? lab.date),
      hb: payload?.hb || null,
      ht: payload?.ht || null,
      leuco: payload?.leuco || null,
      bt: payload?.bt || null,
      plq: payload?.plq || null,
      ur: payload?.ur || null,
      cr: payload?.cr || null,
      pcr: payload?.pcr || null,
      na: payload?.na || null,
      k: payload?.k || null,
      ca: payload?.ca || null,
      lactate: payload?.ac || payload?.lactate || null,
      extraExamName: payload?.extraExamName || null,
      extraExamValue: payload?.extraExamValue || null
    }
  });

  return mapLabRecord(updatedLab);
}

export async function deletePatientLab(patientId, labId, organizationId, sectorIds) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: Number(patientId),
      ...activePatientWhere(organizationId, sectorIds)
    }
  });

  if (!patient) {
    const error = new Error("Paciente nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const lab = await prisma.lab.findFirst({
    where: {
      id: Number(labId),
      patientId: Number(patientId)
    }
  });

  if (!lab) {
    const error = new Error("Exame laboratorial nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  await prisma.lab.delete({
    where: { id: Number(labId) }
  });

  return mapLabRecord(lab);
}
