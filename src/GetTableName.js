require(['vs/editor/editor.main'], function () {
    function getLineTokens(model, lineNumber, column) {
        const tokenizationSupport = model.tokenization._tokens._tokenizer.tokenizationSupport;
        let freshState = tokenizationSupport.getInitialState();
        if (lineNumber > 1) {
            model.tokenization.getLineTokens(lineNumber);
            const states = model.tokenization._tokens._tokenizer.store._tokenizationStateStore._lineEndStates._store
            freshState = states[lineNumber - 1];
        }
        const content = model.getLineContent(lineNumber);
        if (column === undefined) {
            return tokenizationSupport.tokenize(content, 0, freshState).tokens;
        } else if (column > 2) {
            return tokenizationSupport.tokenize(content.substring(0, column - 2), 0, freshState).tokens;
        }
        return tokenizationSupport.tokenize(content.substring(0, column), 0, freshState).tokens;
    }
    //
    function findPrevToken(model, position, linetokens, callback, iParenthesis = 0)
    {
        const content = model.getLineContent(position.lineNumber);
        let preOffset = content.length + 1;
        for (let i = linetokens.length - 1; i >= 0; --i) {
            const token = linetokens[i];
            const startColumn = token.offset;
            const endColumn = preOffset;
            preOffset = token.offset;
            if (position.column !== undefined && position.column - 1 <= startColumn) {
                continue;
            }
            const word = content.substring(startColumn, endColumn);
            if (token.type === "delimiter.parenthesis.sql2") {
                iParenthesis += (word.match(/\)/g) || []).length - (word.match(/\(/g) || []).length;
                if (iParenthesis < 0){
                    iParenthesis = 0;
                }
            } else if (token.type === "delimiter.sql2" && word.includes(';')) {
                return null;
            } else if (iParenthesis !== 0) {
                continue;
            }
            ret = callback(token.type, word);
            if (ret !== undefined){
                return ret;
            }
        }
        if (position.lineNumber <= 1) {
            return null;
        }
        const nextPosition = {
            lineNumber: position.lineNumber - 1
        };
        return findPrevToken(model, nextPosition, getLineTokens(model, nextPosition.lineNumber), callback, iParenthesis);
    }
    function findNextToken(model, position, linetokens, callback, iParenthesis = 0) {
        const content = model.getLineContent(position.lineNumber);
        for (let i = 0; i < linetokens.length; ++i) {
            const token = linetokens[i];
            if (token.offset < position.column){
                continue;
            }
            const endColumn = (i+1) === linetokens.length ? content.length + 1 : linetokens[i+1].offset;
            const word = content.substring(token.offset, endColumn);
            if (token.type === "delimiter.parenthesis.sql2") {
                iParenthesis -= (word.match(/\)/g) || []).length - (word.match(/\(/g) || []).length;
                if (iParenthesis < 0){
                    iParenthesis = 0;
                }
            } else if (token.type === "delimiter.sql2" && word.includes(';')) {
                return null;
            } else if (iParenthesis !== 0) {
                continue;
            }
            ret = callback(token.type, word);
            if (ret !== undefined){
                return ret;
            }
        }
        if (position.lineNumber >= model.getLineCount()) {
            return null;
        }
        const nextPosition = {
            lineNumber: position.lineNumber + 1
        };
        return findNextToken(model, nextPosition, getLineTokens(model, nextPosition.lineNumber), callback, iParenthesis);
    }
    function getPrevTableName(model, position, linetokens) {
        let tablename = null;
        return findPrevToken(model, position, linetokens, (type, word) => {
            if (type === "keyword.sql2" && word.match(/^(FROM|UPDATE|INTO|TABLE)$/i)) {
                return tablename;
            } else if (type === "identifier.sql2") {
                tablename = word;
            }
            return undefined;
        });
    }
    function getNextTableName(model, position, linetokens) {
        let matchTable = false;
        return findNextToken(model, position, linetokens, (type, word) => {
            if (type === "keyword.sql2" && word.match(/^(FROM|UPDATE|INTO|TABLE)$/i)) {
                matchTable = true;
            } else if (type === "identifier.sql2") {
                if (matchTable){
                    return word;
                }
            }
            return undefined;
        });
    }
    function getPrevAliasName(alias, model, position, linetokens) {
        let matchTables = [];
        return findPrevToken(model, position, linetokens, (type, word) => {
            if (type === "keyword.sql2" || type === "operator.sql2") {
                if (word.match(/^(FROM|UPDATE|INTO|TABLE|JOIN)$/i)) {
                    if (matchTables.length >= 2 
                        && matchTables[matchTables.length-2] === alias) {
                        return matchTables[matchTables.length-1];
                    } else if (matchTables.length >= 1
                        && matchTables[matchTables.length-1] === alias) {
                        return alias;
                    }
                }
                matchTables = [];
            } else if (type === "identifier.sql2") {
                matchTables.push(word);
            }
            return undefined;
        });
    }
    function getNextAliasName(alias, model, position, linetokens) {
        let matchTables = [];
        return findNextToken(model, position, linetokens, (type, word) => {
            if (type === "keyword.sql2" || type === "operator.sql2"){
                if (word.match(/^(FROM|UPDATE|INTO|TABLE|JOIN)$/i)) {
                    matchTables = [word];
                }
            } else if (type === "identifier.sql2") {
                matchTables.push(word);
                if (matchTables.length === 2 && word === alias){
                    return alias;
                } else if (matchTables.length === 3 && word === alias){
                    return matchTables[1];
                }
            }
            return undefined;
        });
    }
    function getTableName(model, position) {
        const linetokens = getLineTokens(model, position.lineNumber);
        let bNotSuggest = true;
        for (let i = 0; i < linetokens.length; ++i) {
            const token = linetokens[i];
            if (token.offset <= position.column && 
                (
                    i >= linetokens.length - 1
                    || position.column <= linetokens[i+1].offset
                )
            )
            {
                bNotSuggest = (token.type === "comment.sql2" || token.type === "identifier.quote.sql2");
                break;
            }
        }
        if (bNotSuggest){
            return null;
        }
        const word = model.getWordAtPosition(model.modifyPosition(position, -1));
        if (word) {
            ret = getPrevAliasName(word.word, model, position, linetokens);
            if (!ret) {
                ret = getNextAliasName(word.word, model, position, linetokens);
            }
            return ret ? ret : word.word;
        }
        ret = getPrevTableName(model, position, linetokens);
        if (ret){
            return ret;
        }
        ret = getNextTableName(model, position, linetokens);
        return ret ? ret : getDefTablename();
    }
})
