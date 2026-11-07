"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";
import type React from "react";

/**
 * Base UI 表单根组件的项目入口，集中转发原生表单与字段校验能力。
 * Project entry for the Base UI form root, forwarding form and field-validation behavior.
 */
export function Form({ className, ...props }: FormPrimitive.Props): React.ReactElement {
  return <FormPrimitive className={className} data-slot="form" {...props} />;
}

export { FormPrimitive };
