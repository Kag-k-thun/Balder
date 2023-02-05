#! /bin/bash

verts=$(find ./ | grep [.]vert$)
frags=$(find ./ | grep [.]frag$)
comps=$(find ./ | grep [.]comp$)

all="$verts $frags $comps"

for v in $all
do
    res="$v.spv"
    if test -f "$res"; then
	if [[ $v -nt $res ]]; then
	    echo "[INFO] compile shader $v"
	    glslc $v -o $res
	fi
    else
	echo "[INFO] compile shader $v"
	glslc $v -o $res
    fi
done
