//go:build js && wasm
// +build js,wasm

package main

import (
	"strings"
	"syscall/js"

	"github.com/ikawaha/kagome-dict/ipa"
	"github.com/ikawaha/kagome/v2/tokenizer"
)

var t *tokenizer.Tokenizer

func init() {
	var err error
	t, err = tokenizer.New(ipa.Dict(), tokenizer.OmitBosEos())
	if err != nil {
		panic(err)
	}
}

func tokenize(_ js.Value, args []js.Value) interface{} {
	if len(args) == 0 {
		return nil
	}
	
	text := args[0].String()
	tokens := t.Tokenize(text)
	
	var ret []interface{}
	for _, token := range tokens {
		pos := strings.Join(token.POS(), ",")
		baseForm, _ := token.BaseForm()
		reading, _ := token.Reading()
		
		ret = append(ret, map[string]interface{}{
			"surface":    token.Surface,
			"pos":        pos,
			"baseForm":   baseForm,
			"reading":    reading,
			"start":      token.Start,
			"end":        token.Start + len(token.Surface),
			"posType":    getPOSType(token.POS()),
		})
	}
	
	return ret
}

func getPOSType(pos []string) string {
	if len(pos) == 0 {
		return "other"
	}
	return pos[0]
}

func main() {
	c := make(chan struct{})
	js.Global().Set("kagome_tokenize", js.FuncOf(tokenize))
	println("Kagome WASM Ready")
	<-c
}
