// Schema do wizard de setup pos-checkout - declarado AQUI, pelo modulo, nunca pelo
// componente generico do wizard (novatech-site). Mesmo formato/contrato ja usado
// pelo modulo Restaurante (modules/internal/setupSchema.ts) - mudar o FORMATO exige
// mudar os dois lados (o site duplica este tipo de proposito, nao ha pacote
// @novatech/shared publicado ainda).
//
// Servido cru via GET /internal/setup-schema (requireInternalToken).

export type SetupFieldType =
  | "texto"
  | "numero"
  | "telefone"
  | "horario"
  | "upload_imagem"
  | "color_picker"
  | "lista_repetivel";

export interface SetupField {
  nome: string;
  tipo: SetupFieldType;
  label: string;
  obrigatorio?: boolean;
  padrao?: string | number;
  placeholder?: string;
  itemCampos?: SetupField[];
}

export interface SetupStep {
  id: string;
  titulo: string;
  destino: "core" | "modulo";
  campos: SetupField[];
}

export interface SetupSchema {
  moduloId: string;
  etapas: SetupStep[];
}

export const armarioDigitalSetupSchema: SetupSchema = {
  moduloId: "armario-digital",
  etapas: [
    {
      id: "identidade",
      titulo: "Identidade da sua escola",
      destino: "core",
      campos: [
        { nome: "businessName", tipo: "texto", label: "Nome da escola", obrigatorio: true },
        {
          nome: "logoUrl",
          tipo: "upload_imagem",
          label: "Logo",
          obrigatorio: false,
          placeholder: "https://.../logo.png",
        },
        { nome: "primaryColor", tipo: "color_picker", label: "Cor principal", padrao: "#1C8C0B" },
        { nome: "phone", tipo: "telefone", label: "Telefone", obrigatorio: false },
        { nome: "address", tipo: "texto", label: "Endereco", obrigatorio: false },
      ],
    },
    {
      id: "grade-horaria",
      titulo: "Grade de horarios das aulas",
      destino: "modulo",
      campos: [
        {
          nome: "periodos",
          tipo: "lista_repetivel",
          label: "Horarios/periodos de aula",
          obrigatorio: false,
          itemCampos: [{ nome: "name", tipo: "texto", label: "Nome do horario (ex: 1o horario)", obrigatorio: true }],
        },
      ],
    },
  ],
};
