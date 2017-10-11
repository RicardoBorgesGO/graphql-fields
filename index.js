'use strict';

function getSelections(ast) {
    if (ast &&
        ast.selectionSet &&
        ast.selectionSet.selections &&
        ast.selectionSet.selections.length) {
        return ast.selectionSet.selections;
    }

    return [];
}

function isFragment(ast) {
    return ast.kind === 'InlineFragment' || ast.kind === 'FragmentSpread';
}

function getAST(ast, info) {
    if (ast.kind === 'FragmentSpread') {
        const fragmentName = ast.name.value;
        //return info.fragments[fragmentName];
        return info;
    }
    return ast;
}


function flattenAST(ast, info, obj) {
    obj = obj || {};
    return getSelections(ast).reduce((flattened, a) => {
        if (isFragment(a)) {
            flattened = flattenAST(getAST(a, info.definitions[1]), info, flattened);
        } else {
            const name = a.name.value;
            if (flattened[name]) {
                Object.assign(flattened[name], flattenAST(a, info, flattened[name]));
            } else {
                flattened[name] = flattenAST(a, info);
            }
        }


        return flattened;
    }, obj);
}

/**
 * Retorna todos os fields de uma consulta utilizando como nome os alias.
 * @param ast
 * @param info
 * @param obj
 * @returns {*}
 */
function flattenASTAlias(ast, info, obj) {
    obj = obj || {};
    return getSelections(ast).reduce((flattened, a) => {
        if (isFragment(a)) {
            flattened = flattenASTAlias(getAST(a, info.definitions[1]), info, flattened);
        } else {
            const name = a.alias ? a.alias.value : a.name.value;
            if (flattened[name]) {
                Object.assign(flattened[name], flattenASTAlias(a, info, flattened[name]));
            } else {
                flattened[name] = flattenASTAlias(a, info);
            }
        }

        return flattened;
    }, obj);
}

function graphqlFields(info, obj) {
    obj = obj || {};
    const fields = info.fieldNodes || info.fieldASTs;
    return fields.reduce((o, ast) => {
            return flattenAST(ast, info, o);
        }, obj) || {};
}

function graphqlQuery(ast, typeInfo,visit, visitWithTypeInfo) {
    let byTypes = [], byFields = [], byFieldsAlias = [], headers = [], headersAlias = [];
    visit(ast, visitWithTypeInfo(typeInfo, {
        Field(node) {
            const fieldDef = typeInfo.getFieldDef();
            byTypes.push({
                name: fieldDef.name,
                type: fieldDef.type,
                alias: node.alias ? node.alias.value : "",
                description: fieldDef.description
            });
            !node.selectionSet && (
                byFields.push(fieldDef.name),
                    byFieldsAlias.push(node.alias ? node.alias.value : fieldDef.name)
            );
        }
    }));    
    visitNodes(flattenAST(ast.definitions[0],ast),headers);
    visitNodes(flattenASTAlias(ast.definitions[0],ast),headersAlias);
    return {
        schema: flattenAST(ast.definitions[0]),
        schemaAlias: flattenASTAlias(ast.definitions[0]),
        fieldsByNode: headers,
        fieldsByNode: headersAlias,
        fields: byFields,
        fieldsAlias: byFieldsAlias,
        mapper: byTypes
    };
}

function visitNodes(obj,headers,parent) {
    for (let key in obj) {
        if (typeof obj[key] === 'object') {
            let coluna = parent ? parent + "." + key : key
            if (Object.keys(obj[key]).length == 0){
                headers.push(coluna);
                continue;
            }
            visitNodes(obj[key],headers, coluna);
        }
    }
}


module.exports = {graphqlFields, flattenAST, flattenASTAlias, graphqlQuery};
