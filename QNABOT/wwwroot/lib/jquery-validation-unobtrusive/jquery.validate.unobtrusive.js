(function ($) {
    var $jQval = $.validator,
        adapters,
        data_validation = "unobtrusiveValidation";

    function setValidationValues(options, ruleName, value) {
        options.rules[ruleName] = value;
        if (options.message) {
            options.messages[ruleName] = options.message;
        }
    }

    function splitAndTrim(value) {
        return value.replace(/^\s+|\s+$/g, "").split(/\s*,\s*/g);
    }

    function escapeAttributeValue(value) {
        // Como se mencionó en http://api.jquery.com/category/selectors/
        return value.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
    }

    function getModelPrefix(fieldName) {
        return fieldName.substr(0, fieldName.lastIndexOf(".") + 1);
    }

    function appendModelPrefix(value, prefix) {
        if (value.indexOf("*.") === 0) {
            value = value.replace("*.", prefix);
        }
        return value;
    }

    function onError(error, inputElement) {  // 'this' es el elemento de formulario
        var container = $(this).find("[data-valmsg-for='" + escapeAttributeValue(inputElement[0].name) + "']"),
            replaceAttrValue = container.attr("data-valmsg-replace"),
            replace = replaceAttrValue ? $.parseJSON(replaceAttrValue) !== false : null;

        container.removeClass("field-validation-valid").addClass("field-validation-error");
        error.data("unobtrusiveContainer", container);

        if (replace) {
            container.empty();
            error.removeClass("input-validation-error").appendTo(container);
        }
        else {
            error.hide();
        }
    }

    function onErrors(event, validator) {  // 'this' es el elemento de formulario
        var container = $(this).find("[data-valmsg-summary=true]"),
            list = container.find("ul");

        if (list && list.length && validator.errorList.length) {
            list.empty();
            container.addClass("validation-summary-errors").removeClass("validation-summary-valid");

            $.each(validator.errorList, function () {
                $("<li />").html(this.message).appendTo(list);
            });
        }
    }

    function onSuccess(error) {  // 'this' es el elemento de formulario
        var container = error.data("unobtrusiveContainer");

        if (container) {
            var replaceAttrValue = container.attr("data-valmsg-replace"),
                replace = replaceAttrValue ? $.parseJSON(replaceAttrValue) : null;

            container.addClass("field-validation-valid").removeClass("field-validation-error");
            error.removeData("unobtrusiveContainer");

            if (replace) {
                container.empty();
            }
        }
    }

    function onReset(event) {  // 'this' es el elemento de formulario
        var $form = $(this),
            key = '__jquery_unobtrusive_validation_form_reset';
        if ($form.data(key)) {
            return;
        }
        // Establece un indicador que indica que estamos actualizando el formulario.
        $form.data(key, true);
        try {
            $form.data("validator").resetForm();
        } finally {
            $form.removeData(key);
        }

        $form.find(".validation-summary-errors")
            .addClass("validation-summary-valid")
            .removeClass("validation-summary-errors");
        $form.find(".field-validation-error")
            .addClass("field-validation-valid")
            .removeClass("field-validation-error")
            .removeData("unobtrusiveContainer")
            .find(">*")  // Si estuviéramos usando remplazo de validacion de mensajes, obtenemos el error.
                .removeData("unobtrusiveContainer");
    }

    function validationInfo(form) {
        var $form = $(form),
            result = $form.data(data_validation),
            onResetProxy = $.proxy(onReset, form),
            defaultOptions = $jQval.unobtrusive.options || {},
            execInContext = function (name, args) {
                var func = defaultOptions[name];
                func && $.isFunction(func) && func.apply(form, args);
            }

        if (!result) {
            result = {
                options: {  // estructura de opciones pasada al método validate () de jQuery
                    errorClass: defaultOptions.errorClass || "input-validation-error",
                    errorElement: defaultOptions.errorElement || "span",
                    errorPlacement: function () {
                        onError.apply(form, arguments);
                        execInContext("errorPlacement", arguments);
                    },
                    invalidHandler: function () {
                        onErrors.apply(form, arguments);
                        execInContext("invalidHandler", arguments);
                    },
                    messages: {},
                    rules: {},
                    success: function () {
                        onSuccess.apply(form, arguments);
                        execInContext("success", arguments);
                    }
                },
                attachValidation: function () {
                    $form
                        .off("reset." + data_validation, onResetProxy)
                        .on("reset." + data_validation, onResetProxy)
                        .validate(this.options);
                },
                validate: function () {  /// una función de validación que es llamada por Ajax
                    $form.validate();
                    return $form.valid();
                }
            };
            $form.data(data_validation, result);
        }

        return result;
    }

    $jQval.unobtrusive = {
        adapters: [],

        parseElement: function (element, skipAttach) {
            /// <resumen>
            /// Analiza un solo elemento HTML para atributos de validación discretos.
            /// </ summary>
            /// <param name = "element" domElement = "true"> El elemento HTML a analizar. </ param>
            /// <param name = "skipAttach" type = "Boolean"> [Opcional] verdadero para omitir la conexión del
            /// validación al formulario. Si analiza solo este elemento, debe especificar verdadero.
            /// Si analiza varios elementos, debe especificar si es false y adjuntar manualmente la validación
            /// al formulario cuando hayas terminado. El valor predeterminado es falso. </ Param>
            var $element = $(element),
                form = $element.parents("form")[0],
                valInfo, rules, messages;

            if (!form) {  // No se puede hacer la validación del lado del cliente sin un formulario
                return;
            }

            valInfo = validationInfo(form);
            valInfo.options.rules[element.name] = rules = {};
            valInfo.options.messages[element.name] = messages = {};

            $.each(this.adapters, function () {
                var prefix = "data-val-" + this.name,
                    message = $element.attr(prefix),
                    paramValues = {};

                if (message !== undefined) {  // Comparar contra indefinido, porque un mensaje vacío es legal (y falso)
                    prefix += "-";

                    $.each(this.params, function () {
                        paramValues[this] = $element.attr(prefix + this);
                    });

                    this.adapt({
                        element: element,
                        form: form,
                        message: message,
                        params: paramValues,
                        rules: rules,
                        messages: messages
                    });
                }
            });

            $.extend(rules, { "__dummy__": true });

            if (!skipAttach) {
                valInfo.attachValidation();
            }
        },

        parse: function (selector) {
            /// <resumen>
            /// Analiza todos los elementos HTML en el selector especificado. Busca elementos de entrada decorados
            /// con el valor del atributo [data-val = true] y habilita la validación de acuerdo con data-val- *
            /// valores de atributo.
            /// </ summary>
            /// <param name = "selector" type = "String"> Cualquier selector jQuery válido. </ param>
            // $ forms incluye todos los formularios en la jerarquía DOM del selector (padre, hijos y self) que tienen al menos un
            // elemento con data-val = true
            var $selector = $(selector),
                $forms = $selector.parents()
                                  .addBack()
                                  .filter("form")
                                  .add($selector.find("form"))
                                  .has("[data-val=true]");

            $selector.find("[data-val=true]").each(function () {
                $jQval.unobtrusive.parseElement(this, true);
            });

            $forms.each(function () {
                var info = validationInfo(this);
                if (info) {
                    info.attachValidation();
                }
            });
        }
    };

    adapters = $jQval.unobtrusive.adapters;

    adapters.add = function (adapterName, params, fn) {
        /// <summary> Agrega un nuevo adaptador para convertir HTML discreto en una validación jQuery Validate. </ summary>
        /// <param name = "adapterName" type = "String"> El nombre del adaptador que se agregará. Esto coincide con el nombre usado
        /// en el atributo de HTML data-val-nnnn (donde nnnn es el nombre del adaptador). </ param>
        /// <param name = "params" type = "Array" optional = "true"> [Opcional] Una matriz de nombres de parámetros (cadenas) que
        /// se extraerá de los atributos de HTML data-val-nnnn-mmmm (donde nnnn es el nombre del adaptador, y
        /// mmmm es el nombre del parámetro). </ param>
        /// <param name = "fn" type = "Function"> La función para llamar, que adapta los valores del HTML
        /// atributos en jQuery Validar reglas y / o mensajes. </ param>
        /// <returns type = "jQuery.validator.unobtrusive.adapters" />
        if (!fn) {  // Llamado sin parametros, solo una función
            fn = params;
            params = [];
        }
        this.push({ name: adapterName, params: params, adapt: fn });
        return this;
    };

    adapters.addBool = function (adapterName, ruleName) {
        /// <summary> Agrega un nuevo adaptador para convertir HTML discreto en una validación jQuery Validate, donde
        /// la regla de validación jQuery Validate no tiene valores de parámetros. </ summary>
        /// <param name = "adapterName" type = "String"> El nombre del adaptador que se agregará. Esto coincide con el nombre usado
        /// en el atributo de HTML data-val-nnnn (donde nnnn es el nombre del adaptador). </ param>
        /// <param name = "ruleName" type = "String" optional = "true"> [Optional] El nombre de la regla jQuery Validate. Si no se proporciona, el valor
        /// de adapterName se usará en su lugar. </ param>
        /// <returns type = "jQuery.validator.unobtrusive.adapters" />
        return this.add(adapterName, function (options) {
            setValidationValues(options, ruleName || adapterName, true);
        });
    };

    adapters.addMinMax = function (adapterName, minRuleName, maxRuleName, minMaxRuleName, minAttribute, maxAttribute) {
        /// <summary> Agrega un nuevo adaptador para convertir HTML discreto en una validación jQuery Validate, donde
        /// la validación jQuery Validate tiene tres reglas posibles (una para min-only, una para max-only, y
        /// uno para min-y-max). Se espera que los parámetros de HTML se denominen -min y -max. </ Summary>
        /// <param name = "adapterName" type = "String"> El nombre del adaptador que se agregará. Esto coincide con el nombre usado
        /// en el atributo de HTML data-val-nnnn (donde nnnn es el nombre del adaptador). </ param>
        /// <param name = "minRuleName" type = "String"> El nombre de la regla jQuery Validate que se utilizará cuando solo
        /// tiene un valor mínimo. </ param>
        /// <param name = "maxRuleName" type = "String"> El nombre de la regla jQuery Validate que se usará cuando solo
        /// tiene un valor máximo. </ param>
        /// <param name = "minMaxRuleName" type = "String"> El nombre de la regla jQuery Validate que se usará cuando
        /// tienen un valor mínimo y máximo. </ param>
        /// <param name = "minAttribute" type = "String" optional = "true"> [Optional] El nombre del atributo HTML que
        /// contiene el valor mínimo. El valor predeterminado es "min". </ Param>
        /// <param name = "maxAttribute" type = "String" optional = "true"> [Optional] El nombre del atributo HTML que
        /// contiene el valor máximo. El valor predeterminado es "max". </ Param>
        /// <returns type = "jQuery.validator.unobtrusive.adapters" />
        return this.add(adapterName, [minAttribute || "min", maxAttribute || "max"], function (options) {
            var min = options.params.min,
                max = options.params.max;

            if (min && max) {
                setValidationValues(options, minMaxRuleName, [min, max]);
            }
            else if (min) {
                setValidationValues(options, minRuleName, min);
            }
            else if (max) {
                setValidationValues(options, maxRuleName, max);
            }
        });
    };

    adapters.addSingleVal = function (adapterName, attribute, ruleName) {
         /// <summary> Agrega un nuevo adaptador para convertir HTML discreto en una validación jQuery Validate, donde
         /// la regla de validación jQuery Validate tiene un único valor. </ summary>
         /// <param name = "adapterName" type = "String"> El nombre del adaptador que se agregará. Esto coincide con el nombre usado
         /// en el atributo de HTML data-val-nnnn (donde nnnn es el nombre del adaptador). </ param>
         /// <param name = "attribute" type = "String"> [Optional] El nombre del atributo HTML que contiene el valor.
         /// El valor predeterminado es "val". </ Param>
         /// <param name = "ruleName" type = "String" optional = "true"> [Optional] El nombre de la regla jQuery Validate. Si no se proporciona, el valor
         /// de adapterName se usará en su lugar. </ param>
         /// <returns type = "jQuery.validator.unobtrusive.adapters" />
        return this.add(adapterName, [attribute || "val"], function (options) {
            setValidationValues(options, ruleName || adapterName, options.params[attribute]);
        });
    };

    $jQval.addMethod("__dummy__", function (value, element, params) {
        return true;
    });

    $jQval.addMethod("regex", function (value, element, params) {
        var match;
        if (this.optional(element)) {
            return true;
        }

        match = new RegExp(params).exec(value);
        return (match && (match.index === 0) && (match[0].length === value.length));
    });

    $jQval.addMethod("nonalphamin", function (value, element, nonalphamin) {
        var match;
        if (nonalphamin) {
            match = value.match(/\W/g);
            match = match && match.length >= nonalphamin;
        }
        return match;
    });

    if ($jQval.methods.extension) {
        adapters.addSingleVal("accept", "mimtype");
        adapters.addSingleVal("extension", "extension");
    } else {
        
        adapters.addSingleVal("extension", "extension", "accept");
    }
    // para compatibilidad con versiones anteriores, cuando el método de validación de "extensión" no existe, como con versiones
    // de JQuery Validation plugin anterior a 1.10, debemos usar el método 'accept' para
    // validar la extensión e ignorar las validaciones tipo mime ya que no son compatibles.
    adapters.addSingleVal("regex", "pattern");
    adapters.addBool("creditcard").addBool("date").addBool("digits").addBool("email").addBool("number").addBool("url");
    adapters.addMinMax("length", "minlength", "maxlength", "rangelength").addMinMax("range", "min", "max", "range");
    adapters.addMinMax("minlength", "minlength").addMinMax("maxlength", "minlength", "maxlength");
    adapters.add("equalto", ["other"], function (options) {
        var prefix = getModelPrefix(options.element.name),
            other = options.params.other,
            fullOtherName = appendModelPrefix(other, prefix),
            element = $(options.form).find(":input").filter("[name='" + escapeAttributeValue(fullOtherName) + "']")[0];

        setValidationValues(options, "equalTo", element);
    });
    adapters.add("required", function (options) {
        // jQuery Validate iguala "obligatorio" con "obligatorio" para los elementos de la casilla de verificación
        if (options.element.tagName.toUpperCase() !== "INPUT" || options.element.type.toUpperCase() !== "CHECKBOX") {
            setValidationValues(options, "required", true);
        }
    });
    adapters.add("remote", ["url", "type", "additionalfields"], function (options) {
        var value = {
            url: options.params.url,
            type: options.params.type || "GET",
            data: {}
        },
            prefix = getModelPrefix(options.element.name);
        $.each(splitAndTrim(options.params.additionalfields || options.element.name), function (i, fieldName) {
            var paramName = appendModelPrefix(fieldName, prefix);
            value.data[paramName] = function () {
                var field = $(options.form).find(":input").filter("[name='" + escapeAttributeValue(paramName) + "']");
                // Para casillas de verificación y botones de opción, solo selecciona valores de los campos marcados.
                if (field.is(":checkbox")) {
                    return field.filter(":checked").val() || field.filter(":hidden").val() || '';
                }
                else if (field.is(":radio")) {
                    return field.filter(":checked").val() || '';
                }
                return field.val();
            };
        });

        setValidationValues(options, "remote", value);
    });
    adapters.add("password", ["min", "nonalphamin", "regex"], function (options) {
        if (options.params.min) {
            setValidationValues(options, "minlength", options.params.min);
        }
        if (options.params.nonalphamin) {
            setValidationValues(options, "nonalphamin", options.params.nonalphamin);
        }
        if (options.params.regex) {
            setValidationValues(options, "regex", options.params.regex);
        }
    });

    $(function () {
        $jQval.unobtrusive.parse(document);
    });
}(jQuery));