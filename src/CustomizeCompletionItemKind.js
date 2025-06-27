require(['vs/editor/common/languages', 'vs/base/common/codicons'], function (languages, codicons) {
    if (!languages.CompletionItemKinds.orgToIcon){
        const byKind = {};
        function addCompletionItemKind(kind, icon)
        {
            if (!monaco.languages.CompletionItemKind[kind]){
                const n = Object.keys(monaco.languages.CompletionItemKind).length / 2;
                monaco.languages.CompletionItemKind[n] = kind;
                monaco.languages.CompletionItemKind[kind] = n;
                byKind[n] = icon;
                byKind[kind] = n;
            }
        }
        addCompletionItemKind("Key", codicons.Codicon.key);
        addCompletionItemKind("Table", codicons.Codicon.table);
        //
        languages.CompletionItemKinds.orgToIcon = languages.CompletionItemKinds.toIcon;
        languages.CompletionItemKinds.toIcon = (kind) => {
            return byKind[kind] ? byKind[kind] : languages.CompletionItemKinds.orgToIcon(kind);
        }
        //
        languages.CompletionItemKinds.orgToLabel = languages.CompletionItemKinds.toLabel;
        languages.CompletionItemKinds.toLabel = (kind) => {
            return byKind[kind] ? byKind[kind] : languages.CompletionItemKinds.orgToLabel(kind);
        }
        //
        languages.CompletionItemKinds.orgFromString = languages.CompletionItemKinds.fromString;
        languages.CompletionItemKinds.fromString = (value, strict) => {
            return byKind[kind] ? byKind[kind] : languages.CompletionItemKinds.orgFromString(value, strict);
        }
    }
})